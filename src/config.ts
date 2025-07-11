import { PluginSettingTab, Setting, App, Notice, ButtonComponent } from 'obsidian';
import PublishToDiscourse from './main';
import { t } from './i18n';

export interface DiscourseSyncSettings {
	baseUrl: string;
	apiKey: string;
	disUser: string;
	category: number;
	skipH1: boolean;
	userApiKey?: string; // 新增
}

export const DEFAULT_SETTINGS: DiscourseSyncSettings = {
	baseUrl: "https://yourforum.example.com",
	apiKey: "apikey",
	disUser: "DiscourseUsername",
	category: 1,
	skipH1: false,
	userApiKey: "" // 新增
};

export class DiscourseSyncSettingsTab extends PluginSettingTab {
	plugin: PublishToDiscourse;
	constructor(app: App, plugin: PublishToDiscourse) {
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

		new Setting(containerEl)
			.setName(t('SKIP_H1'))
			.setDesc(t('SKIP_H1_DESC'))
			.addToggle((toggle) => 
				toggle
					.setValue(this.plugin.settings.skipH1)
					.onChange(async (value) => {
						this.plugin.settings.skipH1 = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("User-Api-Key")
			.setDesc("通过Discourse授权后获得的User-Api-Key，优先用于API请求")
			.addText((text) =>
				text
					.setPlaceholder("user_api_key")
					.setValue(this.plugin.settings.userApiKey || "")
					.setDisabled(true)
			)
			.addButton((button: ButtonComponent) => {
				button.setButtonText("生成User-Api-Key");
				button.onClick(async () => {
					const { generateKeyPairAndNonce, saveKeyPair, loadKeyPair, clearKeyPair } = await import("./crypto");
					const pair = generateKeyPairAndNonce();
					saveKeyPair(pair);
					const url = `${this.plugin.settings.baseUrl.replace(/\/$/,"")}/user-api-key/new?` +
						`application_name=Obsidian%20Discourse%20Plugin&client_id=obsidian-${Date.now()}&scopes=read,write&public_key=${encodeURIComponent(pair.publicKeyPem)}&nonce=${pair.nonce}`;
					window.open(url, '_blank');
					new Notice("已生成密钥对并跳转授权页面，请授权后粘贴payload。", 8000);
					this.display();
				});
			});

		// payload输入框和解密按钮
		new Setting(containerEl)
			.setName("解密payload")
			.setDesc("请粘贴Discourse返回的payload，自动解密user-api-key")
			.addText((text) => {
				text.setPlaceholder("payload base64");
				text.inputEl.style.width = '80%';
				(text as any).payloadValue = '';
				text.onChange((value) => {
					(text as any).payloadValue = value;
				});
			})
			.addButton((button: ButtonComponent) => {
				button.setButtonText("解密并保存");
				button.onClick(async () => {
					const { decryptUserApiKey, clearKeyPair } = await import("./crypto");
					const payload = (containerEl.querySelector('input[placeholder="payload base64"]') as HTMLInputElement)?.value;
					if (!payload) { new Notice("请先粘贴payload"); return; }
					try {
						const userApiKey = await decryptUserApiKey(payload);
						this.plugin.settings.userApiKey = userApiKey;
						await this.plugin.saveSettings();
						clearKeyPair();
						new Notice("User-Api-Key解密成功！", 5000);
						this.display();
					} catch (e) {
						new Notice("User-Api-Key解密失败: " + e, 8000);
					}
				});
			});

		new Setting(containerEl)
			.setName(t('TEST_API_KEY'))
			.setDesc('')
			.addButton((button: ButtonComponent) => {
				button
					.setButtonText(t('TEST_API_KEY'))
					.setCta()
					.onClick(async () => {
						button.setButtonText(t('TESTING'));
						button.setDisabled(true);
						
						const result = await this.plugin.api.testApiKey();
						
						button.setButtonText(t('TEST_API_KEY'));
						button.setDisabled(false);
						
						if (result.success) {
							new Notice(result.message, 5000);
						} else {
							const errorEl = containerEl.createDiv('discourse-api-error');
							errorEl.createEl('h3', { text: t('API_TEST_FAILED') });
							
							const formattedMessage = typeof result.message === 'string' 
								? result.message 
								: JSON.stringify(result.message, null, 2);
							
							errorEl.createEl('p', { text: formattedMessage });
							
							errorEl.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
							errorEl.style.border = '1px solid rgba(255, 0, 0, 0.3)';
							errorEl.style.borderRadius = '5px';
							errorEl.style.padding = '10px';
							errorEl.style.marginTop = '10px';
							
							setTimeout(() => {
								errorEl.remove();
							}, 10000);
						}
					});
			});
	}
}
