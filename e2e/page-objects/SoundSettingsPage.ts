import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for Sound Settings interactions
 * Encapsulates all sound settings UI interactions for cleaner tests
 */
export class SoundSettingsPage {
  readonly page: Page;

  // Settings button and modal
  readonly settingsButton: Locator;
  readonly settingsModal: Locator;
  readonly closeButton: Locator;

  // Sound tab and controls
  readonly soundsTab: Locator;
  readonly enableToggle: Locator;
  readonly volumeSlider: Locator;

  // Sound selection
  readonly positiveSoundSection: Locator;
  readonly negativeSoundSection: Locator;

  constructor(page: Page) {
    this.page = page;

    // Settings access - use aria labels and roles
    this.settingsButton = page.getByRole('button', { name: /settings/i });
    this.settingsModal = page.getByRole('dialog');
    this.closeButton = page.getByRole('button', { name: /close/i });

    // Sound tab
    this.soundsTab = page.getByRole('tab', { name: /sounds/i });

    // Controls within the modal
    this.enableToggle = page.getByRole('switch', { name: /enable sound effects/i });
    this.volumeSlider = page.getByRole('slider', { name: /volume/i });

    // Sound sections
    this.positiveSoundSection = page.locator('[data-testid="positive-sound-section"]');
    this.negativeSoundSection = page.locator('[data-testid="negative-sound-section"]');
  }

  /**
   * Open settings modal and navigate to sounds tab
   */
  async openSoundSettings(): Promise<void> {
    await this.settingsButton.click();
    await expect(this.settingsModal).toBeVisible();
    await this.soundsTab.click();
    // Wait for tab content to be visible
    await expect(this.enableToggle).toBeVisible({ timeout: 5000 });
  }

  /**
   * Close the settings modal
   */
  async closeSettings(): Promise<void> {
    await this.closeButton.click();
    await expect(this.settingsModal).not.toBeVisible();
  }

  /**
   * Toggle sound effects on/off
   */
  async toggleSoundEffects(): Promise<void> {
    await this.enableToggle.click();
  }

  /**
   * Check if sound effects are enabled
   */
  async isSoundEnabled(): Promise<boolean> {
    return await this.enableToggle.isChecked();
  }

  /**
   * Set volume using the slider
   * @param percentage - Volume percentage (0-100)
   */
  async setVolume(percentage: number): Promise<void> {
    // Playwright's fill doesn't work on range inputs, use keyboard navigation
    await this.volumeSlider.focus();

    // Get current value
    const currentValue = await this.volumeSlider.inputValue();
    const current = parseInt(currentValue) || 70;

    // Calculate steps needed (assuming step of 1)
    const diff = percentage - current;
    const key = diff > 0 ? 'ArrowRight' : 'ArrowLeft';

    for (let i = 0; i < Math.abs(diff); i++) {
      await this.page.keyboard.press(key);
    }
  }

  /**
   * Get current volume value
   */
  async getVolume(): Promise<number> {
    const value = await this.volumeSlider.inputValue();
    return parseInt(value) || 0;
  }

  /**
   * Select a positive sound by name
   */
  async selectPositiveSound(soundName: string): Promise<void> {
    const soundButton = this.page.getByRole('radio', { name: new RegExp(soundName, 'i') });
    await soundButton.click();
  }

  /**
   * Select a negative sound by name
   */
  async selectNegativeSound(soundName: string): Promise<void> {
    const soundButton = this.page.getByRole('radio', { name: new RegExp(soundName, 'i') });
    await soundButton.click();
  }

  /**
   * Preview a sound by clicking the preview button
   */
  async previewSound(category: 'positive' | 'negative'): Promise<void> {
    const previewButton = this.page.getByRole('button', {
      name: new RegExp(`preview ${category}`, 'i')
    });
    await previewButton.click();
  }

  /**
   * Get the currently selected positive sound name
   */
  async getSelectedPositiveSound(): Promise<string | null> {
    const selected = this.positiveSoundSection.getByRole('radio', { checked: true });
    if (await selected.count() === 0) return null;
    return await selected.getAttribute('aria-label');
  }

  /**
   * Get the currently selected negative sound name
   */
  async getSelectedNegativeSound(): Promise<string | null> {
    const selected = this.negativeSoundSection.getByRole('radio', { checked: true });
    if (await selected.count() === 0) return null;
    return await selected.getAttribute('aria-label');
  }

  /**
   * Wait for settings to be saved (look for success indicator)
   */
  async waitForSave(): Promise<void> {
    // Settings auto-save, wait for any loading indicator to disappear
    const loadingIndicator = this.page.locator('[data-loading="true"]');
    await expect(loadingIndicator).toHaveCount(0, { timeout: 5000 });
  }
}
