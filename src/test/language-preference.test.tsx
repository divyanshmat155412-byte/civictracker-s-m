import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";

let choose: ReturnType<typeof useLanguage>["setLanguage"];
function Probe() {
  const { language, setLanguage } = useLanguage();
  choose = setLanguage;
  return <output data-testid="preference">{language}</output>;
}

describe("language preference behavior", () => {
  beforeEach(() => localStorage.clear());
  it("restores Hindi from the saved preference", async () => {
    localStorage.setItem("app-language", "hi");
    render(<LanguageProvider><Probe /></LanguageProvider>);
    await waitFor(() => expect(screen.getByTestId("preference").textContent).toBe("hi"));
    expect(document.documentElement.lang).toBe("hi");
  });
  it("persists changes in both directions without reloading", async () => {
    const originalUrl = window.location.href;
    render(<LanguageProvider><Probe /></LanguageProvider>);
    act(() => choose("hi"));
    expect(localStorage.getItem("app-language")).toBe("hi");
    expect(document.documentElement.lang).toBe("hi");
    act(() => choose("en"));
    expect(localStorage.getItem("app-language")).toBe("en");
    expect(screen.getByTestId("preference").textContent).toBe("en");
    expect(window.location.href).toBe(originalUrl);
  });
});