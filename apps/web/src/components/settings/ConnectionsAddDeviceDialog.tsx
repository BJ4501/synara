// FILE: ConnectionsAddDeviceDialog.tsx
// Purpose: "Add" on Control this computer — a single-use pairing code shown as a QR
//          for phones and as a short code for other computers, plus the requests
//          that still need a manual approval.
// Layer: Settings UI components
// Exports: ConnectionsAddDeviceDialog

import { useState } from "react";

import { useTranslation } from "~/i18n";
import { remoteDeviceKind, type RemoteHostState } from "~/lib/hosts/remoteAccess";
import { ClockIcon, RefreshCwIcon } from "~/lib/icons";
import { SegmentedPicker } from "../SegmentedPicker";
import { Button } from "../ui/button";
import { CopyTextButton } from "../ui/copyTextButton";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Spinner } from "../ui/spinner";
import { type AddDeviceHeroVariant, ConnectionsAddDeviceHero } from "./ConnectionsAddDeviceHero";
import { RootFingerprint } from "./ConnectionsRows";
import {
  DEVICE_PAIRING_CARD_CLASS_NAME as CARD_CLASS_NAME,
  PairingCode,
  PendingDeviceApprovalCard,
  useDevicePairing,
} from "./DevicePairing";
import { PairingQrCode } from "./PairingQrCode";

type DeviceTab = "phone" | "computer";

const DEVICE_TABS = [
  { value: "phone", label: "Phone or iPad" },
  { value: "computer", label: "Computer" },
] as const;

const HELP_TEXT_CLASS_NAME = "text-center text-ui-sm leading-relaxed text-muted-foreground";

export function ConnectionsAddDeviceDialog({
  open,
  onOpenChange,
  createCode,
  state,
  loadError,
  onChanged,
  computerNoun,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** False when opened only to review pending requests. */
  createCode: boolean;
  state: RemoteHostState | null;
  loadError: string | null;
  onChanged: () => Promise<void>;
  computerNoun: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <AddDeviceDialogContent
          createCode={createCode}
          state={state}
          loadError={loadError}
          onChanged={onChanged}
          onClose={() => onOpenChange(false)}
          computerNoun={computerNoun}
        />
      ) : null}
    </Dialog>
  );
}

function AddDeviceDialogContent({
  createCode,
  state,
  loadError,
  onChanged,
  onClose,
  computerNoun,
}: {
  createCode: boolean;
  state: RemoteHostState | null;
  loadError: string | null;
  onChanged: () => Promise<void>;
  onClose: () => void;
  computerNoun: string;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<DeviceTab>("phone");
  const {
    view,
    pending,
    joined,
    invitation,
    remaining,
    used,
    qrLink,
    email,
    busy,
    error,
    codeRequested,
    newCode,
    approve,
    reject,
  } = useDevicePairing({ createCode, state, loadError, onChanged });
  const firstPending = pending[0];

  const hero: AddDeviceHeroVariant =
    view === "joined"
      ? "linked"
      : view === "approval" && firstPending
        ? remoteDeviceKind(firstPending.pendingDevice.label) === "computer"
          ? "computer"
          : "phone"
        : view === "code" && tab === "computer"
          ? "computer"
          : "phone";
  const joinedNames = joined.map((device) => device.label).join(", ");

  return (
    <DialogPopup className="max-w-[440px] overflow-hidden">
      <ConnectionsAddDeviceHero variant={hero} computerNoun={computerNoun} />
      <DialogHeader className="items-center px-7 pt-5 text-center">
        {view === "approval" ? (
          <>
            <DialogTitle>
              {pending.length === 1
                ? t("settings:conn_approveThisDevice")
                : t("settings:conn_approveTheseDevices")}
            </DialogTitle>
            <DialogDescription>
              {pending.length === 1
                ? t("settings:conn_deviceUsedCode")
                : t("settings:conn_devicesUsedCodes")}
            </DialogDescription>
          </>
        ) : view === "joined" ? (
          <>
            <DialogTitle>
              {t("settings:conn_isAreConnected", { value0: joinedNames, value1: "" }).replace(
                / {2,}/g,
                " ",
              )}
            </DialogTitle>
            <DialogDescription>
              {t("settings:conn_nowControlThis", { value0: joinedNames, value1: computerNoun })}
            </DialogDescription>
          </>
        ) : view === "code" ? (
          <>
            <DialogTitle>
              {t("settings:conn_connectDeviceToThis", { value0: computerNoun })}
            </DialogTitle>
            <DialogDescription>
              {email ? (
                <>
                  {t("settings:conn_useSameAccountBoth")}{" "}
                  <span className="font-medium break-all text-foreground">{email}</span>
                </>
              ) : (
                t("settings:conn_useSameAccountBothDevices")
              )}
            </DialogDescription>
          </>
        ) : (
          <>
            <DialogTitle>{t("settings:conn_noRequestsWaiting")}</DialogTitle>
            <DialogDescription>{t("settings:conn_devicesNeedingApproval")}</DialogDescription>
          </>
        )}
      </DialogHeader>
      <DialogPanel className="space-y-4 px-7 pt-4! pb-7">
        {view === "approval"
          ? pending.map((entry) => (
              <PendingDeviceApprovalCard
                key={entry.inviteId}
                entry={entry}
                computerNoun={computerNoun}
                busy={busy}
                onApprove={() => void approve(entry)}
                onReject={() => void reject(entry)}
              />
            ))
          : null}

        {view === "code" ? (
          <>
            <SegmentedPicker<DeviceTab>
              ariaLabel="Device to connect"
              value={tab}
              onValueChange={setTab}
              options={DEVICE_TABS}
            />
            <div className={`${CARD_CLASS_NAME} px-4 pt-4.5 pb-3`}>
              <div className="relative flex h-56 items-center justify-center">
                {invitation ? (
                  <div
                    className={
                      remaining
                        ? "flex w-full justify-center"
                        : "pointer-events-none flex w-full justify-center opacity-10 blur-[2px]"
                    }
                    aria-hidden={remaining ? undefined : true}
                  >
                    {tab === "phone" && qrLink ? (
                      <PairingQrCode value={qrLink} label={t("settings:conn_scanToConnect")} />
                    ) : (
                      <PairingCode code={invitation.code} />
                    )}
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <p role="alert" className="text-ui text-destructive">
                      {error}
                    </p>
                    <Button
                      shape="capsule"
                      variant="subtle"
                      disabled={busy}
                      onClick={() => void newCode()}
                    >
                      {t("common:actionTryAgain")}
                    </Button>
                  </div>
                ) : busy || !codeRequested ? (
                  <p className="flex items-center gap-2 text-ui text-muted-foreground">
                    <Spinner className="size-4" aria-hidden />
                    {t("settings:conn_creatingACode")}
                  </p>
                ) : (
                  <Button shape="capsule" variant="subtle" onClick={() => void newCode()}>
                    {t("settings:conn_newCode")}
                  </Button>
                )}
                {invitation && !remaining ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center">
                    <p className="text-ui font-semibold text-foreground">
                      {used ? t("settings:conn_codeWasUsed") : t("settings:conn_codeExpired")}
                    </p>
                    <p className="mb-2 text-ui-sm text-muted-foreground">
                      {used
                        ? t("settings:conn_createCodeAnotherDevice")
                        : t("settings:conn_createCodeTryAgain")}
                    </p>
                    <Button
                      shape="capsule"
                      size="sm"
                      disabled={busy}
                      onClick={() => void newCode()}
                    >
                      {t("settings:conn_newCode")}
                    </Button>
                  </div>
                ) : null}
              </div>
              {invitation && remaining ? (
                <div className="mt-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-ui-sm text-muted-foreground tabular-nums">
                    <ClockIcon className="size-3.5" aria-hidden />
                    {t("settings:conn_expiresIn", { value0: remaining })}
                  </span>
                  <span className="flex items-center gap-0.5 text-muted-foreground">
                    <CopyTextButton
                      text={invitation.code}
                      label={t("settings:conn_codeAria")}
                      iconOnly
                    />
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={t("settings:conn_newCode")}
                      title={t("settings:conn_newCode")}
                      disabled={busy}
                      onClick={() => void newCode()}
                    >
                      <RefreshCwIcon className="size-3" />
                    </Button>
                  </span>
                </div>
              ) : null}
            </div>
            {invitation && remaining && tab === "phone" ? (
              <p className={HELP_TEXT_CLASS_NAME}>
                {t("settings:conn_cantScanEnter", { value0: invitation.code })}{" "}
                {t("settings:conn_inSynaraOnPhone")}
              </p>
            ) : null}
            {invitation && remaining && tab === "computer" ? (
              <>
                <p className={HELP_TEXT_CLASS_NAME}>
                  {t("settings:conn_onOtherComputerOpen")}{" "}
                  <span className="font-medium text-foreground">
                    {t("settings:conn_settingsConnectionsControlOther")}
                  </span>
                  {t("settings:conn_clickAddAndEnter")}
                </p>
                <div className="space-y-1.5 rounded-[14px] border border-border py-2.5 ps-3.5 pe-2">
                  <p className="text-ui-xs text-muted-foreground">
                    {t("settings:conn_thenCheckFingerprint", { value0: computerNoun })}
                  </p>
                  <RootFingerprint value={invitation.rootFingerprint} className="text-foreground" />
                </div>
              </>
            ) : null}
          </>
        ) : null}

        {error && !(view === "code" && !invitation) ? (
          <p role="alert" className="text-center text-ui text-destructive">
            {error}
          </p>
        ) : null}

        {view === "joined" || view === "empty" || (view === "approval" && !createCode) ? (
          <Button
            shape="capsule"
            variant={view === "approval" ? "subtle" : "default"}
            className="w-full"
            onClick={onClose}
          >
            {t("common:actionDone")}
          </Button>
        ) : null}
      </DialogPanel>
    </DialogPopup>
  );
}
