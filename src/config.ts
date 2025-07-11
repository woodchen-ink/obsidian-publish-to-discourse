import { PluginSettingTab, Setting, App, Notice, ButtonComponent } from 'obsidian';
import PublishToDiscourse from './main';
import { t } from './i18n';

export interface DiscourseSyncSettings {
	baseUrl: string;
	category: number;
	skipH1: boolean;
	userApiKey: string;
	lastNotifiedVersion?: string; // 记录上次显示更新通知的版本
}

export const DEFAULT_SETTINGS: DiscourseSyncSettings = {
	baseUrl: "https://yourforum.example.com",
	category: 1,
	skipH1: false,
	userApiKey: ""
};

export class DiscourseSyncSettingsTab extends PluginSettingTab {
	plugin: PublishToDiscourse;
	constructor(app: App, plugin: PublishToDiscourse) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ====== 基础配置 ======
		const basicSection = containerEl.createDiv('discourse-config-section');
		basicSection.createEl('h2', { text: '🔧 ' + t('CONFIG_BASIC_TITLE') });
		basicSection.createEl('p', { 
			text: t('CONFIG_BASIC_DESC'),
			cls: 'setting-item-description'
		});

		new Setting(basicSection)
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

		// 显示当前的 User-API-Key
		const userApiKey = this.plugin.settings.userApiKey;
		const hasApiKey = userApiKey && userApiKey.trim() !== '';
		
		new Setting(basicSection)
			.setName(t('USER_API_KEY'))
			.setDesc(hasApiKey ? t('USER_API_KEY_DESC') : t('USER_API_KEY_EMPTY'))
			.addText((text) => {
				text
					.setPlaceholder(hasApiKey ? "••••••••••••••••••••••••••••••••" : t('USER_API_KEY_EMPTY'))
					.setValue(hasApiKey ? userApiKey : "")
					.setDisabled(true);
				
				// 设置样式让文本看起来像密码
				if (hasApiKey) {
					text.inputEl.style.fontFamily = 'monospace';
					text.inputEl.style.fontSize = '12px';
					text.inputEl.style.color = 'var(--text-muted)';
				}
			})
			.addButton((button: ButtonComponent) => {
				if (hasApiKey) {
					button
						.setButtonText("📋 " + t('COPY_API_KEY'))
						.setTooltip(t('COPY_API_KEY'))
						.onClick(async () => {
							try {
								await navigator.clipboard.writeText(userApiKey);
								new Notice(t('API_KEY_COPIED'), 3000);
							} catch (error) {
								// 降级方案：使用传统的复制方法
								const textArea = document.createElement('textarea');
								textArea.value = userApiKey;
								document.body.appendChild(textArea);
								textArea.select();
								document.execCommand('copy');
								document.body.removeChild(textArea);
								new Notice(t('API_KEY_COPIED'), 3000);
							}
						});
				} else {
					button
						.setButtonText("⬇️ 获取")
						.setTooltip("跳转到获取 API Key 的流程")
						.onClick(() => {
							// 滚动到 API Key 获取区域
							const apiSection = containerEl.querySelector('.discourse-config-section:nth-child(2)');
							if (apiSection) {
								apiSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
							}
						});
				}
			});

		// ====== 获取 User-API-Key ======
		const apiSection = containerEl.createDiv('discourse-config-section');
		apiSection.createEl('h2', { text: '🔑 ' + t('CONFIG_API_TITLE') });
		apiSection.createEl('p', { 
			text: t('CONFIG_API_DESC'),
			cls: 'setting-item-description'
		});

		// 步骤 1: 确认论坛地址
		const step1 = apiSection.createDiv('discourse-step');
		step1.createDiv('discourse-step-title').textContent = t('STEP_VERIFY_URL');
		step1.createDiv('discourse-step-description').textContent = t('STEP_VERIFY_URL_DESC');

		// 步骤 2: 生成授权链接
		const step2 = apiSection.createDiv('discourse-step');
		step2.createDiv('discourse-step-title').textContent = t('STEP_GENERATE_AUTH');
		step2.createDiv('discourse-step-description').textContent = t('STEP_GENERATE_AUTH_DESC');
		
		new Setting(step2)
			.setName(t('GENERATE_AUTH_LINK'))
			.setDesc(t('GENERATE_AUTH_DESC'))
			.addButton((button: ButtonComponent) => {
				button.setButtonText("🚀 " + t('GENERATE_AUTH_LINK'));
				button.onClick(async () => {
					const { generateKeyPairAndNonce, saveKeyPair } = await import("./crypto");
					const pair = generateKeyPairAndNonce();
					saveKeyPair(pair);
					const url = `${this.plugin.settings.baseUrl.replace(/\/$/,"")}/user-api-key/new?` +
						`application_name=Obsidian%20Discourse%20Plugin&client_id=obsidian-${Date.now()}&scopes=read,write&public_key=${encodeURIComponent(pair.publicKeyPem)}&nonce=${pair.nonce}`;
					window.open(url, '_blank');
					new Notice(t('AUTH_LINK_GENERATED'), 8000);
					this.display();
				});
			});

		// 步骤 3: 完成授权并复制 Payload
		const step3 = apiSection.createDiv('discourse-step');
		step3.createDiv('discourse-step-title').textContent = t('STEP_AUTHORIZE');
		step3.createDiv('discourse-step-description').textContent = t('STEP_AUTHORIZE_DESC');

		// 步骤 4: 解密并保存 User-API-Key
		const step4 = apiSection.createDiv('discourse-step');
		step4.createDiv('discourse-step-title').textContent = t('STEP_DECRYPT');
		step4.createDiv('discourse-step-description').textContent = t('STEP_DECRYPT_DESC');
		
		new Setting(step4)
			.setName(t('DECRYPT_PAYLOAD'))
			.setDesc(t('DECRYPT_PAYLOAD_DESC'))
			.addText((text) => {
				text.setPlaceholder(t('PAYLOAD_PLACEHOLDER'));
				text.inputEl.style.width = '80%';
				(text as any).payloadValue = '';
				text.onChange((value) => {
					(text as any).payloadValue = value;
				});
			})
			.addButton((button: ButtonComponent) => {
				button.setButtonText("🔓 " + t('DECRYPT_AND_SAVE'));
				button.onClick(async () => {
					const { decryptUserApiKey, clearKeyPair } = await import("./crypto");
					const payload = (containerEl.querySelector(`input[placeholder="${t('PAYLOAD_PLACEHOLDER')}"]`) as HTMLInputElement)?.value;
					if (!payload) { new Notice("请先粘贴payload"); return; }
					try {
						const userApiKey = await decryptUserApiKey(payload);
						this.plugin.settings.userApiKey = userApiKey;
						await this.plugin.saveSettings();
						clearKeyPair();
						new Notice(t('DECRYPT_SUCCESS'), 5000);
						this.display();
					} catch (e) {
						new Notice(t('DECRYPT_FAILED') + e, 8000);
					}
				});
			});

		// 步骤 5: 测试连接
		const step5 = apiSection.createDiv('discourse-step');
		step5.createDiv('discourse-step-title').textContent = t('STEP_TEST');
		step5.createDiv('discourse-step-description').textContent = t('STEP_TEST_DESC');
		
		new Setting(step5)
			.setName(t('TEST_API_KEY'))
			.setDesc(t('STEP_TEST_DESC'))
			.addButton((button: ButtonComponent) => {
				button
					.setButtonText("🔍 " + t('TEST_API_KEY'))
					.setCta()
					.onClick(async () => {
						button.setButtonText("🔄 " + t('TESTING'));
						button.setDisabled(true);
						
						const result = await this.plugin.api.testApiKey();
						
						button.setButtonText("🔍 " + t('TEST_API_KEY'));
						button.setDisabled(false);
						
						if (result.success) {
							new Notice("✅ " + result.message, 5000);
						} else {
							// 使用 Obsidian 的默认 Notice 进行错误提示
							const formattedMessage = typeof result.message === 'string' 
								? result.message 
								: JSON.stringify(result.message, null, 2);
							
							new Notice("❌ " + t('API_TEST_FAILED') + "\n" + formattedMessage, 8000);
						}
					});
			});

		// ====== 发布选项 ======
		const publishSection = containerEl.createDiv('discourse-config-section');
		publishSection.createEl('h2', { text: '📝 ' + t('CONFIG_PUBLISH_TITLE') });
		publishSection.createEl('p', { 
			text: t('CONFIG_PUBLISH_DESC'),
			cls: 'setting-item-description'
		});

		new Setting(publishSection)
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
	}
}
