const OFFLINE_EVENT = "stockspot-connection-lost";

export function reportConnectionFailure(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const transportFailure =
    error instanceof TypeError ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed");
  if (transportFailure && typeof window !== "undefined") {
    window.dispatchEvent(new Event(OFFLINE_EVENT));
  }
}

export const connectionLostEvent = OFFLINE_EVENT;