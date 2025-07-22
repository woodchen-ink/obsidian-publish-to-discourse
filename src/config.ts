import { PluginSettingTab, Setting, App, Notice, ButtonComponent } from 'obsidian';
import PublishToDiscourse from './main';
import { t } from './i18n';
import { ForumPresetEditModal } from './ui';

// 论坛预设配置
export interface ForumPreset {
	id: string;
	name: string;
	baseUrl: string;
	userApiKey: string;
}

export interface DiscourseSyncSettings {
	// 单论坛配置（向后兼容）
	baseUrl: string;
	category: number;
	skipH1: boolean;
	convertHighlight: boolean; // 是否转换==高亮==为 <mark> 格式
	ignoreHeadings: string; // 忽略特定标题内的内容
	useRemoteImageUrl: boolean;
	userApiKey: string;
	lastNotifiedVersion?: string; // 记录上次显示更新通知的版本
	
	// 多论坛配置
	enableMultiForums: boolean; // 是否启用多论坛功能
	forumPresets: ForumPreset[]; // 论坛预设列表
	selectedForumId?: string; // 当前选择的论坛ID
}

export const DEFAULT_SETTINGS: DiscourseSyncSettings = {
	baseUrl: "https://yourforum.example.com",
	category: 1,
	skipH1: false,
	convertHighlight: true, // 默认转换 ==高亮== 为 <mark>
	ignoreHeadings: "", 
	useRemoteImageUrl: true, //默认启用
	userApiKey: "",
	enableMultiForums: false,
	forumPresets: []
};

export class DiscourseSyncSettingsTab extends PluginSettingTab {
	plugin: PublishToDiscourse;
	private activeTab: 'forum' | 'publish' = 'forum';
	
	constructor(app: App, plugin: PublishToDiscourse) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// 创建Tab导航
		this.createTabNavigation(containerEl);

		// 创建Tab内容容器
		const tabContentEl = containerEl.createDiv('tab-content');

		// 根据当前活跃Tab显示对应内容
		switch (this.activeTab) {
			case 'forum':
				this.displayForumSettings(tabContentEl);
				break;
			case 'publish':
				this.displayPublishSettings(tabContentEl);
				break;
		}
	}

	private createTabNavigation(containerEl: HTMLElement): void {
		const tabNavEl = containerEl.createDiv('tab-navigation');
		
		const tabs = [
			{ id: 'forum', label: '🌐 ' + t('TAB_FORUM'), desc: t('TAB_FORUM_DESC') },
			{ id: 'publish', label: '📝 ' + t('TAB_PUBLISH'), desc: t('TAB_PUBLISH_DESC') }
		];

		tabs.forEach(tab => {
			const tabEl = tabNavEl.createDiv('tab-item');
			if (this.activeTab === tab.id) {
				tabEl.addClass('active');
			}
			
			const labelEl = tabEl.createDiv('tab-label');
			labelEl.textContent = tab.label;
			
			const descEl = tabEl.createDiv('tab-description');
			descEl.textContent = tab.desc;
			
			tabEl.onclick = () => {
				this.activeTab = tab.id as any;
				this.display();
			};
		});
	}

	private displayForumSettings(containerEl: HTMLElement): void {
		if (this.plugin.settings.enableMultiForums) {
			this.displayMultiForumSettings(containerEl);
		} else {
			this.displaySingleForumSettings(containerEl);
		}
	}

	private displaySingleForumSettings(containerEl: HTMLElement): void {
		// ====== 单论坛配置 ======
		const basicSection = containerEl.createDiv('discourse-config-section');
		basicSection.createEl('h2', { text: t('CONFIG_BASIC_TITLE') });
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

		// ====== 多论坛开关 ======
		const multiForumSection = containerEl.createDiv('discourse-config-section');
		multiForumSection.createEl('h2', { text: t('CONFIG_MULTI_FORUM_TITLE') });
		multiForumSection.createEl('p', { 
			text: t('CONFIG_MULTI_FORUM_DESC'),
			cls: 'setting-item-description'
		});

		new Setting(multiForumSection)
			.setName(t('ENABLE_MULTI_FORUMS'))
			.setDesc(t('ENABLE_MULTI_FORUMS_DESC'))
			.addToggle((toggle) => 
				toggle
					.setValue(this.plugin.settings.enableMultiForums)
					.onChange(async (value) => {
						this.plugin.settings.enableMultiForums = value;
						await this.plugin.saveSettings();
						this.display(); // 重新渲染
					})
			);
	}

	private displayMultiForumSettings(containerEl: HTMLElement): void {
		// ====== 多论坛配置 ======
		const multiForumSection = containerEl.createDiv('discourse-config-section');
		multiForumSection.createEl('h2', { text: t('CONFIG_MULTI_FORUM_TITLE') });
		multiForumSection.createEl('p', { 
			text: t('CONFIG_MULTI_FORUM_DESC'),
			cls: 'setting-item-description'
		});

		// 启用多论坛功能
		new Setting(multiForumSection)
			.setName(t('ENABLE_MULTI_FORUMS'))
			.setDesc(t('ENABLE_MULTI_FORUMS_DESC'))
			.addToggle((toggle) => 
				toggle
					.setValue(this.plugin.settings.enableMultiForums)
					.onChange(async (value) => {
						this.plugin.settings.enableMultiForums = value;
						await this.plugin.saveSettings();
						this.display(); // 重新渲染
					})
			);

		// 如果启用了多论坛功能，显示论坛预设管理
		if (this.plugin.settings.enableMultiForums) {
			// 论坛预设列表
			const presetsContainer = multiForumSection.createDiv('forum-presets-container');
			presetsContainer.createEl('h3', { text: t('FORUM_PRESETS') });

			// 添加新预设按钮
			new Setting(presetsContainer)
				.setName(t('ADD_FORUM_PRESET'))
				.setDesc(t('ADD_FORUM_PRESET_DESC'))
				.addButton((button: ButtonComponent) => {
					button
						.setButtonText("➕ " + t('ADD_FORUM_PRESET'))
						.onClick(() => {
							this.addForumPreset();
						});
				});

			// 显示现有预设
			this.plugin.settings.forumPresets.forEach((preset, index) => {
				this.displayForumPreset(presetsContainer, preset, index);
			});
		}
	}

	private displayPublishSettings(containerEl: HTMLElement): void {
		// ====== 发布选项 ======
		const publishSection = containerEl.createDiv('discourse-config-section');
		publishSection.createEl('h2', { text: t('CONFIG_PUBLISH_TITLE') });
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
			
		new Setting(publishSection)
			.setName(t('CONVERT_HIGHLIGHT'))
			.setDesc(t('CONVERT_HIGHLIGHT_DESC'))
			.addToggle((toggle) => 
				toggle
					.setValue(this.plugin.settings.convertHighlight)
					.onChange(async (value) => {
						this.plugin.settings.convertHighlight = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(publishSection)
			.setName(t('IGNORE_HEADINGS'))
			.setDesc(t('IGNORE_HEADINGS_DESC'))
			.addText((text) =>
				text
					.setPlaceholder(t('IGNORE_HEADINGS_PLACEHOLDER'))
					.setValue(this.plugin.settings.ignoreHeadings)
					.onChange(async (value) => {
						this.plugin.settings.ignoreHeadings = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(publishSection)
			.setName(t('USE_REMOTE_IMAGE_URL'))
			.setDesc(t('USE_REMOTE_IMAGE_URL_DESC'))
			.addToggle((toggle) => 
				toggle
					.setValue(this.plugin.settings.useRemoteImageUrl)
					.onChange(async (value) => {
						this.plugin.settings.useRemoteImageUrl = value;
						await this.plugin.saveSettings();
					})
			);
	}

	private displayForumPreset(container: HTMLElement, preset: ForumPreset, index: number): void {
		const presetContainer = container.createDiv('forum-preset-item');
		
		// 预设名称和状态
		const headerEl = presetContainer.createDiv('preset-header');

		const nameContainer = headerEl.createDiv('preset-name-container');

		const nameEl = nameContainer.createDiv('preset-name');
		nameEl.textContent = `${preset.name}`;
		
		// 预设链接（单独显示 & 可点击）
		const urlEl = nameContainer.createDiv("preset-url");
		urlEl.textContent = preset.baseUrl;
		urlEl.title = preset.baseUrl;
		urlEl.onclick = () => {
		  window.open(preset.baseUrl, "_blank");
		};

		// 当前选中状态
		if (this.plugin.settings.selectedForumId === preset.id) {
			nameEl.addClass('selected');
			nameEl.textContent += ' ✓';
		}

		// userApiKey 明文只读显示
		const hasApiKey = preset.userApiKey && preset.userApiKey.trim() !== '';
		new Setting(presetContainer)
			.setName(t('USER_API_KEY'))
			.setDesc(hasApiKey ? t('USER_API_KEY_DESC') : t('USER_API_KEY_EMPTY'))
			.addText((text) => {
				text
					.setPlaceholder(hasApiKey ? "••••••••••••••••••••••••••••••••" : t('USER_API_KEY_EMPTY'))
					.setValue(hasApiKey ? preset.userApiKey : "")
					.setDisabled(true);
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
								await navigator.clipboard.writeText(preset.userApiKey);
								new Notice(t('API_KEY_COPIED'), 3000);
							} catch (error) {
								const textArea = document.createElement('textarea');
								textArea.value = preset.userApiKey;
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
						.setTooltip(t('USER_API_KEY_EMPTY'))
						.setDisabled(true);
				}
			});

		// 操作按钮
		const actionsEl = headerEl.createDiv('preset-actions');
		
		// 编辑按钮
		const editBtn = actionsEl.createEl('button', { 
			text: '✏️ ' + t('EDIT'),
			cls: 'preset-action-btn'
		});
		editBtn.onclick = () => this.editForumPreset(index);

		// 删除按钮
		const deleteBtn = actionsEl.createEl('button', { 
			text: '🗑️ ' + t('DELETE'),
			cls: 'preset-action-btn delete'
		});
		deleteBtn.onclick = () => this.deleteForumPreset(index);

		// 设为默认按钮
		if (this.plugin.settings.selectedForumId !== preset.id) {
			const setDefaultBtn = actionsEl.createEl('button', { 
				text: '⭐ ' + t('SET_DEFAULT'),
				cls: 'preset-action-btn'
			});
			setDefaultBtn.onclick = () => this.setDefaultForum(preset.id);
		}
	}

	private async addForumPreset(): Promise<void> {
		const newPreset: ForumPreset = {
			id: Date.now().toString(),
			name: t('NEW_FORUM_PRESET'),
			baseUrl: '',
			userApiKey: '',
		};
		
		const editModal = new ForumPresetEditModal(this.app, newPreset, true);
		const result = await editModal.showAndWait();
		
		if (result) {
			this.plugin.settings.forumPresets.push(result);
			await this.plugin.saveSettings();
			this.display();
		}
	}

	private async editForumPreset(index: number): Promise<void> {
		const preset = this.plugin.settings.forumPresets[index];
		
		const editModal = new ForumPresetEditModal(this.app, preset);
		const result = await editModal.showAndWait();
		
		if (result) {
			this.plugin.settings.forumPresets[index] = result;
			await this.plugin.saveSettings();
			this.display();
		}
	}

	private deleteForumPreset(index: number): void {
		const preset = this.plugin.settings.forumPresets[index];
		if (confirm(t('CONFIRM_DELETE_PRESET').replace('{name}', preset.name))) {
			// 如果删除的是当前选中的论坛，清除选择
			if (this.plugin.settings.selectedForumId === preset.id) {
				this.plugin.settings.selectedForumId = undefined;
			}
			
			this.plugin.settings.forumPresets.splice(index, 1);
			this.plugin.saveSettings();
			this.display();
		}
	}

	private setDefaultForum(forumId: string): void {
		this.plugin.settings.selectedForumId = forumId;
		this.plugin.saveSettings();
		this.display();
	}
}
