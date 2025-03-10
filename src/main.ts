import { Menu, MenuItem, Plugin, TFile, moment } from 'obsidian';
import { DEFAULT_SETTINGS, DiscourseSyncSettings, DiscourseSyncSettingsTab } from './config';
import * as yaml from 'yaml';
import { t, setLocale } from './i18n';
import { expandEmbeds } from './expand-embeds';
import { DiscourseAPI } from './api';
import { EmbedHandler } from './embed-handler';
import { SelectCategoryModal } from './ui';
import { NotifyUser } from './notification';
import { getFrontMatter, removeFrontMatter } from './utils';
import { ActiveFile, PluginInterface } from './types';

export default class PublishToDiscourse extends Plugin implements PluginInterface {
	settings: DiscourseSyncSettings;
	activeFile: ActiveFile;
	api: DiscourseAPI;
	embedHandler: EmbedHandler;

	async onload() {
		// 设置语言
		setLocale(moment.locale());

		// 当Obsidian语言变化时更新语言
		this.registerEvent(
			this.app.workspace.on('window-open', () => {
				setLocale(moment.locale());
			})
		);

		// 加载设置
		await this.loadSettings();
		
		// 初始化API和嵌入处理器
		this.api = new DiscourseAPI(this.app, this.settings);
		this.embedHandler = new EmbedHandler(this.app, this.api);
		
		// 添加设置选项卡
		this.addSettingTab(new DiscourseSyncSettingsTab(this.app, this));
		
		// 注册文件菜单
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file: TFile) => {
				this.registerDirMenu(menu, file);
			}),
		);

		// 添加发布命令
		this.addCommand({
			id: "category-modal",
			name: t('PUBLISH_TO_DISCOURSE'),
			callback: () => {
				this.openCategoryModal();
			},
		});

		// 添加在浏览器中打开帖子的命令
		this.addCommand({
			id: "open-in-discourse",
			name: t('OPEN_IN_DISCOURSE'),
			callback: () => {
				this.openInDiscourse();
			},
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// 注册目录菜单
	registerDirMenu(menu: Menu, file: TFile) {
		const syncDiscourse = (item: MenuItem) => {
			item.setTitle(t('PUBLISH_TO_DISCOURSE'));
			item.onClick(async () => {
				const content = await expandEmbeds(this.app, file);
				const fm = getFrontMatter(content);
				this.activeFile = {
					name: file.basename,
					content: content,
					postId: fm?.discourse_post_id
				};
				await this.syncToDiscourse();
			});
		}
		menu.addItem(syncDiscourse)
	}

	// 打开分类选择模态框
	private async openCategoryModal() {
		// 每次都重新获取 activeFile 的最新内容，不使用缓存
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new NotifyUser(this.app, t('NO_ACTIVE_FILE')).open();
			return;
		}
		
		// 使用expandEmbeds处理嵌入内容，而不是直接读取文件内容
		const content = await expandEmbeds(this.app, activeFile);
		const fm = getFrontMatter(content);
		this.activeFile = {
			name: activeFile.basename,
			content: content,
			postId: fm?.discourse_post_id
		};
		
		const [categories, tags] = await Promise.all([
			this.api.fetchCategories(),
			this.api.fetchTags()
		]);
		if (categories.length > 0) {
			new SelectCategoryModal(this.app, this, categories, tags).open();
		}
	}

	// 同步到Discourse
	private async syncToDiscourse() {
		await this.openCategoryModal();
	}

	// 在Discourse中打开
	private async openInDiscourse() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new NotifyUser(this.app, t('NO_ACTIVE_FILE')).open();
			return;
		}

		const content = await this.app.vault.read(activeFile);
		const fm = getFrontMatter(content);
		const discourseUrl = fm?.discourse_url;
		const topicId = fm?.discourse_topic_id;

		if (!discourseUrl && !topicId) {
			new NotifyUser(this.app, t('NO_TOPIC_ID')).open();
			return;
		}

		const url = discourseUrl || `${this.settings.baseUrl}/t/${topicId}`;
		window.open(url, '_blank');
	}

	// 发布主题
	async publishTopic(): Promise<{ success: boolean; error?: string }> {
		let content = this.activeFile.content;
		
		// 移除Front Matter
		content = removeFrontMatter(content);

		// 提取嵌入引用
		const embedReferences = this.embedHandler.extractEmbedReferences(content);
		
		// 处理嵌入内容
		const uploadedUrls = await this.embedHandler.processEmbeds(embedReferences, this.activeFile.name);
		
		// 替换嵌入引用为Markdown格式
		content = this.embedHandler.replaceEmbedReferences(content, embedReferences, uploadedUrls);

		// 获取Front Matter
		const frontMatter = getFrontMatter(this.activeFile.content);
		const postId = frontMatter?.discourse_post_id;
		const topicId = frontMatter?.discourse_topic_id;
		const isUpdate = postId !== undefined;
		
		// 发布或更新帖子
		let result;
		try {
			if (isUpdate) {
				// 更新帖子
				result = await this.api.updatePost(
					postId,
					topicId,
					(frontMatter?.title ? frontMatter?.title : this.activeFile.name),
					content,
					this.settings.category,
					this.settings.selectedTags || []
				);
			} else {
				// 创建新帖子
				result = await this.api.createPost(
					(frontMatter?.title ? frontMatter?.title : this.activeFile.name),
					content,
					this.settings.category,
					this.settings.selectedTags || []
				);
				
				// 如果创建成功，更新Front Matter
				if (result.success && result.postId && result.topicId) {
					await this.updateFrontMatter(result.postId, result.topicId);
				}
			}
			
			// 返回结果
			return result;
		} catch (error) {
			// 返回错误
			return {
				success: false,
				error: error.message || t('UNKNOWN_ERROR')
			};
		}
	}

	// 更新Front Matter
	private async updateFrontMatter(postId: number, topicId: number) {
		try {
			// 获取当前活动文件
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile) {
				return;
			}

			const content = await this.app.vault.read(activeFile);
			const fm = getFrontMatter(content);
			const discourseUrl = `${this.settings.baseUrl}/t/${topicId}`;
			
			let newContent: string;
			if (fm) {
				// 更新现有Front Matter
				const updatedFm = { 
					...fm, 
					discourse_post_id: postId, 
					discourse_topic_id: topicId,
					discourse_url: discourseUrl
				};
				newContent = content.replace(/^---\n[\s\S]*?\n---\n/, `---\n${yaml.stringify(updatedFm)}---\n`);
			} else {
				// 添加新Front Matter
				const newFm = { 
					discourse_post_id: postId, 
					discourse_topic_id: topicId,
					discourse_url: discourseUrl
				};
				newContent = `---\n${yaml.stringify(newFm)}---\n${content}`;
			}
			
			await this.app.vault.modify(activeFile, newContent);
			// 更新activeFile对象
			this.activeFile = {
				name: activeFile.basename,
				content: newContent,
				postId: postId
			};
		} catch (error) {
			new NotifyUser(this.app, t('UPDATE_FAILED')).open();
		}
	}

	onunload() {}
}

