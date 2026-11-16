// FILE: desktop-artifact-identity.ts
// Purpose: Keeps packaged metadata, native identity and artifact names aligned.
import {
  SYNARA_ZH_CN_WINDOWS_INSTALLER_VERSION,
  synaraDesktopIdentity,
  type SynaraPackagedDesktopFlavor,
} from "@synara/shared/desktopIdentity";

export function createDesktopArtifactIdentity(input: {
  readonly platform: "mac" | "linux" | "win";
  readonly flavor: SynaraPackagedDesktopFlavor;
}) {
  // Stable's NSIS GUID deliberately survives public bundle ID changes. An
  // experimental installer must not register itself as that same product;
  // Beta and Remote have their own installer GUIDs.
  if (
    input.platform === "win" &&
    !["production", "beta", "remote", "zh-cn"].includes(input.flavor)
  ) {
    throw new Error("Isolated desktop flavors are currently supported on macOS and Linux only.");
  }
  const identity = synaraDesktopIdentity(input.flavor);
  const suffix = input.flavor === "production" ? "" : `-${input.flavor}`;
  return {
    identity,
    packageMetadata: {
      name: `synara-desktop${suffix}`,
      productName: identity.displayName,
      synaraDesktopFlavor: input.flavor,
    },
    buildConfig: {
      appId: identity.bundleId,
      productName: identity.displayName,
      artifactName: `${identity.displayName.replaceAll(" ", "-")}-\${version}-\${arch}.\${ext}`,
      ...(input.flavor !== "production"
        ? { protocols: [{ name: identity.displayName, schemes: [identity.scheme] }] }
        : {}),
    },
    releaseDirectoryName: `release${suffix}`,
  };
}

/** zh-CN 1.6.0 was the broken splash/timeout payload; the replacement must sort above it. */
export function resolveDesktopArtifactVersion(input: {
  readonly flavor: SynaraPackagedDesktopFlavor;
  readonly explicitVersion?: string | undefined;
  readonly packageVersion: string;
}): string {
  const explicit = input.explicitVersion?.trim();
  if (explicit) return explicit;
  if (input.flavor === "zh-cn" && input.packageVersion === "1.6.0") {
    return SYNARA_ZH_CN_WINDOWS_INSTALLER_VERSION;
  }
  return input.packageVersion;
}
