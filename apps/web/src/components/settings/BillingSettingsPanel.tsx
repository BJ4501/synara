// FILE: BillingSettingsPanel.tsx
// Purpose: The "Synara Alto" section of the Usage Billing tab — monthly and yearly
//          plan cards that each open their checkout plus what Alto includes, or the
//          current plan with Manage and links to the features it unlocks. Checkout and
//          the customer portal open in the browser through Polar, using the
//          server-selected billing environment.
// Layer: Web settings feature

import type { AccountBillingStatus, AccountStatus } from "@synara/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "~/hooks/useAccount";
import { getFormatLocale, useTranslation } from "~/i18n";
import { ACCOUNT_BILLING_ENABLED } from "~/lib/accountBillingFlag";
import { accountBillingQueryOptions } from "~/lib/accountReactQuery";
import {
  formatBillingPrice,
  isPolarBillingUrl,
  runAccountBillingOperation,
} from "~/lib/accountBilling";
import { accountErrorMessage, readAccountErrorCode } from "~/lib/accountLogic";
import { accountStatusScope } from "~/lib/hosts/controlQueryScope";
import {
  BellIcon,
  BotIcon,
  ChevronRightIcon,
  DeviceComputerIcon,
  DeviceMobileIcon,
  ExternalLinkIcon,
  UserIcon,
} from "~/lib/icons";
import { trackReliabilityIssue } from "~/lib/productAnalytics";
import { ensureNativeApi } from "~/nativeApi";
import { useAccountDialogStore } from "../account/accountDialogStore";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "~/lib/utils";
import { SETTINGS_CARD_CLASS_NAME, SETTINGS_RADIUS_CLASS_NAME } from "~/settingsPanelStyles";
import { SettingsCard, SettingsListRow, SettingsSectionShell } from "./SettingsPanelPrimitives";

type BillingPlan = AccountBillingStatus["plans"][number];

/** What Alto adds on top of Free; mirrors the plan list on trysynara.com/pricing. */
const ALTO_FEATURES: ReadonlyArray<{
  icon: typeof BellIcon;
  title: string;
  description?: string;
  soon?: boolean;
}> = [
  {
    icon: DeviceComputerIcon,
    title: "Remote from any computer running Synara",
    description: "Steer, approve and ship from another computer.",
  },
  {
    icon: BellIcon,
    title: "Approvals and alerts",
    description: "Know the moment an agent needs you, wherever you are.",
  },
  {
    icon: UserIcon,
    title: "Your page at trysynara.com/@handle",
    description: "Share the activity, models and streaks from your usage.",
  },
  { icon: DeviceMobileIcon, title: "Remote from iPhone and iPad", soon: true },
  { icon: BotIcon, title: "Synara Bots", soon: true },
];

/** Deep-link target for "See plans" / plan links elsewhere in Settings. */
export const SYNARA_PLAN_SECTION_ID = "settings-synara-plan";

/** Opens the plan section of Usage & limits. */
export function useOpenSynaraPlan() {
  const navigate = useNavigate();
  return () =>
    void navigate({
      to: "/settings",
      search: { section: "usage", target: SYNARA_PLAN_SECTION_ID },
    });
}

/**
 * The signed-in account's Synara plan for Settings › Profile. Null until the plan is
 * known — and in builds without billing, where it is never asked for — so the profile
 * never flashes a guess.
 */
export function useSynaraPlan(): { readonly granted: boolean; readonly open: () => void } | null {
  const { status } = useAccount();
  const signedIn = status?.state === "signed-in";
  const query = useQuery({
    ...accountBillingQueryOptions(status),
    enabled: ACCOUNT_BILLING_ENABLED && signedIn,
  });
  const open = useOpenSynaraPlan();
  if (!ACCOUNT_BILLING_ENABLED || !signedIn || query.data?.available !== true) return null;
  return { granted: query.data.access === "granted", open };
}

export function BillingSettingsPanel() {
  const { status } = useAccount();
  const scope = accountStatusScope(status ?? { state: "signed-out" });
  return <BillingAccountPanel key={scope} status={status} scope={scope} />;
}

function BillingAccountPanel({ status, scope }: { status: AccountStatus | null; scope: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery(accountBillingQueryOptions(status));
  const [pending, setPending] = useState(false);
  // `opened` asks the user to refresh once they are back from the browser.
  const [message, setMessage] = useState<{ text: string; opened: boolean } | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const signedIn = status?.state === "signed-in";
  const billing = query.data;
  const sandbox = billing?.environment === "sandbox";

  const openBilling = async (interval?: "month" | "year") => {
    if (pending || !signedIn || !billing?.available) return;
    setPending(true);
    setMessage(null);
    try {
      const redirect = await runAccountBillingOperation(scope, (account) =>
        interval ? account.billingCheckout({ interval }) : account.billingPortal(),
      );
      if (!mounted.current) return;
      if (
        redirect.environment !== billing.environment ||
        !isPolarBillingUrl(redirect.url, billing.environment)
      ) {
        throw new Error("The billing link could not be verified.");
      }
      await ensureNativeApi().shell.openExternal(redirect.url);
      if (mounted.current) {
        setMessage({
          text: sandbox
            ? "Test billing opened in your browser."
            : "Billing opened in your browser.",
          opened: true,
        });
      }
    } catch (cause) {
      trackReliabilityIssue("billing.redirect_failed");
      if (mounted.current) {
        const fallback = sandbox
          ? t("settings:testBillingOpenFailed")
          : t("settings:billingOpenFailed");
        setMessage({
          text: readAccountErrorCode(cause) ? accountErrorMessage(cause, fallback) : fallback,
          opened: false,
        });
      }
    } finally {
      if (mounted.current) {
        setPending(false);
        void queryClient.invalidateQueries({
          queryKey: accountBillingQueryOptions(status).queryKey,
        });
      }
    }
  };

  return (
    <SettingsSectionShell
      id={SYNARA_PLAN_SECTION_ID}
      title="settings:synaraAltoPro"
      action={
        sandbox ? (
          <Badge variant="outline">{t("settings:billing_sandbox")}</Badge>
        ) : billing?.available ? (
          <span className="px-2 text-ui text-muted-foreground">
            {t("settings:billing_billedByPolar")}
          </span>
        ) : undefined
      }
    >
      {!signedIn ? (
        <SettingsCard>
          <SettingsListRow
            title={t("settings:billing_signInToSubscribe")}
            actions={
              <Button
                variant="outline"
                size="sm"
                disabled={!status}
                onClick={() => useAccountDialogStore.getState().openSignIn()}
              >
                {t("common:actionSignIn")}
              </Button>
            }
          />
        </SettingsCard>
      ) : query.isPending ? (
        <SettingsCard>
          <SettingsListRow title={t("settings:billing_loadingPlans")} />
        </SettingsCard>
      ) : query.isError ? (
        <SettingsCard>
          <SettingsListRow
            title={t("settings:billing_couldntLoadPlans")}
            actions={
              <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
                {t("common:actionTryAgain")}
              </Button>
            }
          />
        </SettingsCard>
      ) : !billing?.available ? (
        <SettingsCard>
          <SettingsListRow
            title={
              sandbox
                ? t("settings:billing_testNotConfigured")
                : t("settings:billing_notConfigured")
            }
          />
        </SettingsCard>
      ) : (
        <>
          {billing.canCheckout ? (
            <>
              <p className="px-2 text-ui text-muted-foreground">
                {t("settings:billing_freeLocalAltoRemote")}
              </p>
              {/* Each card opens its own checkout. */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {sortPlans(billing.plans).map((plan) => (
                  <PlanCard
                    key={plan.interval}
                    plan={plan}
                    plans={billing.plans}
                    disabled={pending}
                    onChoose={() => void openBilling(plan.interval)}
                  />
                ))}
              </div>
              <AltoFeatureList />
              <p className="px-2 text-ui-sm text-muted-foreground">
                {t("settings:billing_checkoutOpensInBrowser")}
              </p>
            </>
          ) : billing.access === "granted" ? (
            <ActiveAltoCard
              billing={billing}
              disabled={pending}
              onManage={() => void openBilling()}
              onOpenSection={(section) => void navigate({ to: "/settings", search: { section } })}
            />
          ) : (
            // Anyone with no plan on offer right now: never an empty section.
            <SettingsCard>
              <SettingsListRow
                title={t("common:actionFree")}
                actions={
                  billing.canManage ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => void openBilling()}
                    >
                      {t("common:actionManage")}
                    </Button>
                  ) : null
                }
              />
            </SettingsCard>
          )}
          {billing.canCheckout && billing.canManage ? (
            // A former subscriber keeps the portal for invoices and payment details.
            <button
              type="button"
              className="self-start px-2 text-ui-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-64"
              disabled={pending}
              onClick={() => void openBilling()}
            >
              {t("settings:billing_manageBilling")}
            </button>
          ) : null}
        </>
      )}
      {message ? (
        <p role="status" className="text-ui-sm text-muted-foreground">
          {message.text}
          {message.opened ? (
            <>
              {" "}
              <button
                type="button"
                className="text-foreground underline-offset-2 hover:underline disabled:opacity-64"
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
              >
                {t("common:actionRefresh")}
              </button>
            </>
          ) : null}
        </p>
      ) : null}
    </SettingsSectionShell>
  );
}

/** Monthly before yearly, whatever order the catalog returns. */
function sortPlans(plans: ReadonlyArray<BillingPlan>): BillingPlan[] {
  return plans.toSorted((a, b) =>
    a.interval === b.interval ? 0 : a.interval === "month" ? -1 : 1,
  );
}

/** Whole-percent saving of the yearly plan over twelve monthly payments, if any. */
function yearlySavingsPercent(plans: ReadonlyArray<BillingPlan>): number | null {
  const monthly = plans.find((plan) => plan.interval === "month");
  const yearly = plans.find((plan) => plan.interval === "year");
  if (!monthly || !yearly || monthly.currency !== yearly.currency || monthly.amountMinor <= 0) {
    return null;
  }
  const percent = Math.round((1 - yearly.amountMinor / (monthly.amountMinor * 12)) * 100);
  return percent > 0 ? percent : null;
}

/** One plan per card. Yearly is the recommended choice whenever both are on offer. */
function PlanCard(props: {
  plan: BillingPlan;
  plans: ReadonlyArray<BillingPlan>;
  disabled: boolean;
  onChoose: () => void;
}) {
  const { t } = useTranslation();
  const monthly = props.plan.interval === "month";
  const label = monthly ? "Monthly" : "Yearly";
  const recommended = !monthly || props.plans.length === 1;
  const savings = monthly ? null : yearlySavingsPercent(props.plans);
  const note = monthly
    ? "Billed monthly, plus tax. Cancel anytime."
    : `${formatBillingPrice({ ...props.plan, amountMinor: Math.round(props.plan.amountMinor / 12) })} a month, billed once a year.`;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-4",
        recommended
          ? cn(SETTINGS_RADIUS_CLASS_NAME, "border-[1.5px] border-foreground bg-card")
          : SETTINGS_CARD_CLASS_NAME,
      )}
    >
      <div className="flex h-5.5 items-center justify-between gap-2">
        <span className="text-ui font-medium text-foreground">{label}</span>
        {savings ? (
          <Badge variant="info">
            {t("common:actionSave")} {savings}%
          </Badge>
        ) : null}
      </div>
      <div className="flex items-baseline gap-1.5">
        {/* The card's headline figure: a heading size, like the page title. */}
        <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
          {formatBillingPrice(props.plan)}
        </span>
        <span className="text-ui text-muted-foreground">
          / {monthly ? t("common:month") : t("common:year")}
        </span>
      </div>
      <p className="text-ui text-muted-foreground">{note}</p>
      <Button
        variant={recommended ? "default" : "outline"}
        size="sm"
        className="mt-auto w-full"
        disabled={props.disabled}
        onClick={props.onChoose}
      >
        {t("common:actionChoose")} {label.toLowerCase()}
      </Button>
    </div>
  );
}

/** What Alto unlocks, with the features that are not out yet marked as such. */
function AltoFeatureList() {
  const { t } = useTranslation();
  return (
    <SettingsCard>
      {ALTO_FEATURES.map((feature) => (
        <SettingsListRow
          key={feature.title}
          leading={<feature.icon className="size-4" />}
          title={
            feature.soon ? (
              <span className="text-muted-foreground">{feature.title}</span>
            ) : (
              feature.title
            )
          }
          description={feature.description}
          actions={
            feature.soon ? (
              <Badge variant="outline">{t("settings:billing_comingSoon")}</Badge>
            ) : undefined
          }
        />
      ))}
    </SettingsCard>
  );
}

/** A subscriber's plan, with Manage for invoices and links to what Alto turns on. */
function ActiveAltoCard(props: {
  billing: AccountBillingStatus;
  disabled: boolean;
  onManage: () => void;
  onOpenSection: (section: "connections" | "profile") => void;
}) {
  const { t } = useTranslation();
  const { billing } = props;
  const ending = billing.cancelAtPeriodEnd;
  const date = billing.validUntil ? formatPlanDate(billing.validUntil) : null;
  const status = ending
    ? date
      ? `Ends ${date}. Invoices and payment method are in Polar.`
      : "Ends at the end of this period."
    : date
      ? `Renews ${date}. Invoices and payment method are in Polar.`
      : "Invoices and payment method are in Polar.";
  return (
    <SettingsCard>
      <SettingsListRow
        title={
          <span className="flex items-center gap-2">
            <span>{t("settings:altoProPlan")}</span>
            <Badge variant={ending ? "warning" : "info"}>
              {ending ? t("settings:billing_ending") : t("common:actionActive")}
            </Badge>
          </span>
        }
        description={status}
        actions={
          billing.canManage ? (
            <Button variant="outline" size="sm" disabled={props.disabled} onClick={props.onManage}>
              {t("common:actionManage")}
              <ExternalLinkIcon />
            </Button>
          ) : null
        }
      />
      <SettingsListRow
        title={t("settings:billing_remoteApprovalsAlerts")}
        description={t("settings:billing_pairComputers")}
        actions={
          <Button variant="ghost" size="sm" onClick={() => props.onOpenSection("connections")}>
            {t("settings:navGroup_connections")}
            <ChevronRightIcon />
          </Button>
        }
      />
      <SettingsListRow
        title={t("settings:billing_publicPage")}
        description={t("settings:billing_shareUsageAt")}
        actions={
          <Button variant="ghost" size="sm" onClick={() => props.onOpenSection("profile")}>
            {t("computer:nav_profile")}
            <ChevronRightIcon />
          </Button>
        }
      />
    </SettingsCard>
  );
}

function formatPlanDate(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(getFormatLocale(), {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}
