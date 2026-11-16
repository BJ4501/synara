// FILE: ConnectionsSettingsPanel.tsx
// Purpose: The Connections pane — three tabs: devices that control this computer,
//          computers this one controls, and SSH.
// Layer: Settings UI components
// Exports: ConnectionsSettingsPanel

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useAccount } from "~/hooks/useAccount";
import { useTranslation } from "~/i18n";
import { accountBillingQueryOptions } from "~/lib/accountReactQuery";
import { readExecutionContext } from "~/lib/hosts/executionContext";
import { isMacNavigatorPlatform } from "~/lib/utils";
import { useAccountDialogStore } from "../account/accountDialogStore";
import { SegmentedPicker } from "../SegmentedPicker";
import { Button } from "../ui/button";
import { ConnectionsOtherComputers } from "./ConnectionsOtherComputers";
import { ConnectionsThisComputer } from "./ConnectionsThisComputer";
import { SettingsListRow, SettingsSection } from "./SettingsPanelPrimitives";
import { SYNARA_PLAN_SECTION_ID } from "./BillingSettingsPanel";

type ConnectionsTab = "this" | "others" | "ssh";

export function ConnectionsSettingsPanel({
  active,
  billingEnabled,
}: {
  active: boolean;
  billingEnabled: boolean;
}) {
  const [tab, setTab] = useState<ConnectionsTab>("this");
  const navigate = useNavigate();
  const account = useAccount();
  const openSignIn = useAccountDialogStore((store) => store.openSignIn);
  const capability = readExecutionContext()?.controller.capabilities;
  const billingOptions = accountBillingQueryOptions(account.status);
  const billing = useQuery({
    ...billingOptions,
    enabled:
      billingOptions.enabled === true &&
      active &&
      billingEnabled &&
      tab === "this" &&
      capability?.remoteConnections === true,
  });
  const { t } = useTranslation();
  if (!active) return null;

  if (capability?.remoteConnections !== true)
    return (
      <SettingsSection title="settings:navGroup_connections">
        <SettingsListRow
          title={t("settings:conn_unavailableInBuild")}
          description={capability?.remoteUnavailableReason ?? t("settings:conn_updateController")}
        />
      </SettingsSection>
    );

  const signedIn = account.me !== null;
  if (!signedIn)
    return (
      <SettingsSection title="settings:navGroup_connections">
        <SettingsListRow
          title={t("settings:conn_signInToConnectDevices")}
          description={t("settings:conn_useSameAccountDevices")}
          actions={
            <Button size="xs" shape="capsule" onClick={openSignIn}>
              {t("common:actionSignIn")}
            </Button>
          }
        />
      </SettingsSection>
    );

  const computerNoun = isMacNavigatorPlatform() ? "Mac" : "computer";
  const canViewProPlans =
    billingEnabled &&
    !billing.isError &&
    billing.data?.available &&
    billing.data.access === "none" &&
    billing.data.canCheckout;
  return (
    <div className="space-y-6">
      <SegmentedPicker<ConnectionsTab>
        ariaLabel={t("settings:navGroup_connections")}
        variant="buttons"
        value={tab}
        onValueChange={setTab}
        options={[
          { value: "this", label: t("settings:conn_controlThisNoun", { value0: computerNoun }) },
          { value: "others", label: t("settings:conn_controlOtherDevices") },
          { value: "ssh", label: "SSH" },
        ]}
      />
      <div>
        {tab === "this" ? (
          <ConnectionsThisComputer
            computerNoun={computerNoun}
            onRefreshBilling={billingEnabled ? () => void billing.refetch() : undefined}
            onViewProPlans={
              canViewProPlans
                ? () =>
                    void navigate({
                      to: "/settings",
                      search: { section: "usage", target: SYNARA_PLAN_SECTION_ID },
                    })
                : undefined
            }
          />
        ) : tab === "others" ? (
          <ConnectionsOtherComputers />
        ) : (
          <ConnectionsSsh />
        )}
      </div>
    </div>
  );
}

/** Only what exists today: device-code linking and a manual SSH forwarding port. */
function ConnectionsSsh() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sshCommand = "--ssh-forward-port";
  const sshHelp = t("settings:conn_startWithThenSsh", { value0: sshCommand });
  const sshCommandAt = sshHelp.indexOf(sshCommand);
  return (
    <SettingsSection title="SSH">
      <SettingsListRow
        title={t("settings:conn_linkHeadless")}
        description={t("settings:conn_headlessHelp")}
        actions={
          <Button
            size="xs"
            shape="capsule"
            variant="subtle"
            onClick={() => void navigate({ to: "/link" })}
          >
            {t("settings:conn_enterACode")}
          </Button>
        }
      />
      <SettingsListRow
        title={t("settings:conn_portForwarding")}
        description={
          sshCommandAt === -1 ? (
            sshHelp
          ) : (
            <>
              {sshHelp.slice(0, sshCommandAt)}
              <code className="font-mono text-ui-sm text-foreground">{sshCommand}</code>
              {sshHelp.slice(sshCommandAt + sshCommand.length)}
            </>
          )
        }
      />
    </SettingsSection>
  );
}
