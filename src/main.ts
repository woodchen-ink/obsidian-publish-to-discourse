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
			id: "publish-to-discourse",
			name: t('PUBLISH_TO_DISCOURSE'),
			callback: () => {
				this.publishToDiscourse();
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
				await this.publishToDiscourse(file);
			});
		}
		menu.addItem(syncDiscourse)
	}

	// 同步到Discourse - 统一入口点
	private async publishToDiscourse(file?: TFile) {
		// 如果提供了特定文件，使用该文件；否则使用当前活动文件
		const targetFile = file || this.app.workspace.getActiveFile();
		if (!targetFile) {
			new NotifyUser(this.app, t('NO_ACTIVE_FILE')).open();
			return;
		}
		
		// 使用expandEmbeds处理嵌入内容
		const content = await expandEmbeds(this.app, targetFile);
		const fm = getFrontMatter(content);
		const postId = fm?.discourse_post_id;
		const topicId = fm?.discourse_topic_id;
		const isUpdate = postId !== undefined && topicId !== undefined;
		
		// 初始化activeFile对象
		this.activeFile = {
			name: targetFile.basename,
			content: content,
			postId: postId,
			// 从frontmatter中获取标签，如果没有则使用空数组
			tags: fm?.discourse_tags || []
		};
		
		// 获取分类和标签列表
		const [categories, tags] = await Promise.all([
			this.api.fetchCategories(),
			this.api.fetchTags()
		]);
		
		// 如果是更新帖子，先从Discourse获取最新标签和分类
		if (isUpdate) {
			try {
				const topicInfo = await this.api.fetchTopicInfo(topicId);
				
				// 用Discourse上的标签覆盖本地标签
				if (topicInfo.tags.length > 0) {
					this.activeFile.tags = topicInfo.tags;
					console.log(`Updated tags from Discourse: ${topicInfo.tags.join(', ')}`);
				}
				
				// 如果获取到了分类ID，更新设置中的分类
				if (topicInfo.categoryId) {
					// 查找分类名称
					const category = categories.find(c => c.id === topicInfo.categoryId);
					if (category) {
						this.settings.category = category.id;
						console.log(`Updated category from Discourse: ${category.name} (${category.id})`);
					}
				}
			} catch (error) {
				console.error("Failed to fetch topic info from Discourse:", error);
				// 如果获取失败，继续使用本地标签和分类
			}
		}
		
		if (categories.length > 0) {
			new SelectCategoryModal(this.app, this, categories, tags).open();
		}
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

		// 如果启用了"跳过一级标题"选项，则删除所有H1标题
		if (this.settings.skipH1) {
			// 匹配Markdown中的所有H1标题（# 标题）
			content = content.replace(/^\s*# [^\n]+\n?/gm, '');
		}

		// 获取Front Matter
		const frontMatter = getFrontMatter(this.activeFile.content);
		const postId = frontMatter?.discourse_post_id;
		const topicId = frontMatter?.discourse_topic_id;
		const isUpdate = postId !== undefined;
		
		// 获取当前选择的标签
		const currentTags = this.activeFile.tags || [];
		
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
					currentTags
				);
				
				// 如果更新成功，更新Front Matter
				if (result.success) {
					await this.updateFrontMatter(postId, topicId, currentTags);
				}
			} else {
				// 创建新帖子
				result = await this.api.createPost(
					(frontMatter?.title ? frontMatter?.title : this.activeFile.name),
					content,
					this.settings.category,
					currentTags
				);
				
				// 如果创建成功，更新Front Matter
				if (result.success && result.postId && result.topicId) {
					await this.updateFrontMatter(result.postId, result.topicId, currentTags);
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
	private async updateFrontMatter(postId: number, topicId: number, tags: string[]) {
		try {
			// 获取当前活动文件
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile) {
				return;
			}

			const content = await this.app.vault.read(activeFile);
			const fm = getFrontMatter(content);
			const discourseUrl = `${this.settings.baseUrl}/t/${topicId}`;
			
			// 获取当前分类信息
			const categoryId = this.settings.category;
			// 查找分类名称
			const categories = await this.api.fetchCategories();
			const category = categories.find(c => c.id === categoryId);
			const categoryName = category ? category.name : '';
			
			let newContent: string;
			if (fm) {
				// 更新现有Front Matter
				const updatedFm = { 
					...fm, 
					discourse_post_id: postId, 
					discourse_topic_id: topicId,
					discourse_url: discourseUrl,
					discourse_tags: tags,
					discourse_category_id: categoryId,
					discourse_category: categoryName
				};
				newContent = content.replace(/^---\n[\s\S]*?\n---\n/, `---\n${yaml.stringify(updatedFm)}---\n`);
			} else {
				// 添加新Front Matter
				const newFm = { 
					discourse_post_id: postId, 
					discourse_topic_id: topicId,
					discourse_url: discourseUrl,
					discourse_tags: tags,
					discourse_category_id: categoryId,
					discourse_category: categoryName
				};
				newContent = `---\n${yaml.stringify(newFm)}---\n${content}`;
			}
			
			await this.app.vault.modify(activeFile, newContent);
			// 更新activeFile对象
			this.activeFile = {
				name: activeFile.basename,
				content: newContent,
				postId: postId,
				tags: tags
			};
		} catch (error) {
			new NotifyUser(this.app, t('UPDATE_FAILED')).open();
		}
	}

	onunload() {}
}

