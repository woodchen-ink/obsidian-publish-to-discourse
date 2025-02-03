import { PluginSettingTab, Setting, App } from 'obsidian';
import DiscourseSyncPlugin from './main';
import { t } from './i18n';

export interface DiscourseSyncSettings {
	baseUrl: string;
	apiKey: string;
	disUser: string;
	category: number;
	selectedTags: string[];
}

export const DEFAULT_SETTINGS: DiscourseSyncSettings = {
	baseUrl: "https://yourforum.example.com",
	apiKey: "apikey",
	disUser: "DiscourseUsername",
	category: 1,
	selectedTags: []
};

export class DiscourseSyncSettingsTab extends PluginSettingTab {
	plugin: DiscourseSyncPlugin;
	constructor(app: App, plugin: DiscourseSyncPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName(t('FORUM_URL'))
			.setDesc(t('FORUM_URL_DESC'))
			.addText((text) =>
				text
					.setPlaceholder("https://forum.example.com")
					.setValue(this.plugin.settings.baseUrl)
					.onChange(async (value) => {
						this.plugin.settings.baseUrl = value;
						await this.plugin.saveSettings();
					})
		);

		new Setting(containerEl)
			.setName(t('API_KEY'))
			.setDesc(t('API_KEY_DESC'))
			.addText((text) =>
				text
					.setPlaceholder("api_key")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					})
		);

		new Setting(containerEl)
			.setName(t('USERNAME'))
			.setDesc(t('USERNAME_DESC'))
			.addText((text) =>
				text
					.setPlaceholder("username")
					.setValue(this.plugin.settings.disUser)
					.onChange(async (value) => {
						this.plugin.settings.disUser = value;
						await this.plugin.saveSettings();
					}),
		);
	}
}
