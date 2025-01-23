import { App, Menu, MenuItem, Plugin, Modal, requestUrl, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, DiscourseSyncSettings, DiscourseSyncSettingsTab } from './config';
import * as yaml from 'yaml';

export default class DiscourseSyncPlugin extends Plugin {
	settings: DiscourseSyncSettings;
	activeFile: { 
		name: string; 
		content: string;
		postId?: number; // 添加帖子ID字段
	};
	async onload() {
		await this.loadSettings();
		this.addSettingTab(new DiscourseSyncSettingsTab(this.app, this));
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file: TFile) => {
				this.registerDirMenu(menu, file);
			}),
		);

		this.addCommand({
			id: "category-modal",
			name: "发布到 Discourse",
			callback: () => {
				this.openCategoryModal();
			},
		});

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	extractImageReferences(content: string): string[] {
		const regex = /!\[\[(.*?)\]\]/g;
		const matches = [];
		let match;
		while ((match = regex.exec(content)) !== null) {
			matches.push(match[1]);
		}
		return matches;
	}

	async uploadImages(imageReferences: string[]): Promise<string[]> {
		const imageUrls: string[] = [];
		for (const ref of imageReferences) {
			const filePath = this.app.metadataCache.getFirstLinkpathDest(ref, this.activeFile.name)?.path;
			if (filePath) {
				const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
				if (abstractFile instanceof TFile) {
					try {
						const imgfile = await this.app.vault.readBinary(abstractFile);
						const boundary = genBoundary();
						const sBoundary = '--' + boundary + '\r\n';
						const imgForm = `${sBoundary}Content-Disposition: form-data; name="file"; filename="${abstractFile.name}"\r\nContent-Type: image/${abstractFile.extension}\r\n\r\n`;


						let body = '';
						body += `\r\n${sBoundary}Content-Disposition: form-data; name="type"\r\n\r\ncomposer\r\n`;
						body += `${sBoundary}Content-Disposition: form-data; name="synchronous"\r\n\r\ntrue\r\n`;

						const eBoundary = '\r\n--' + boundary + '--\r\n';
						const imgFormArray = new TextEncoder().encode(imgForm);
						const bodyArray = new TextEncoder().encode(body);
						const endBoundaryArray = new TextEncoder().encode(eBoundary);

						const formDataArray = new Uint8Array(imgFormArray.length + imgfile.byteLength + bodyArray.length + endBoundaryArray.length);
						formDataArray.set(imgFormArray, 0);
						formDataArray.set(new Uint8Array(imgfile), imgFormArray.length);
						formDataArray.set(bodyArray, imgFormArray.length + imgfile.byteLength);
						formDataArray.set(endBoundaryArray, imgFormArray.length + bodyArray.length + imgfile.byteLength);

						const url = `${this.settings.baseUrl}/uploads.json`;
						const headers = {
							"Api-Key": this.settings.apiKey,
							"Api-Username": this.settings.disUser,
							"Content-Type": `multipart/form-data; boundary=${boundary}`,
						};

						const response = await requestUrl({
							url: url,
							method: "POST",
							body: formDataArray.buffer,
							throw: false,
							headers: headers,
						});

						if (response.status == 200) {
							const jsonResponse = response.json;
							imageUrls.push(jsonResponse.short_url);
						} else {
							new NotifyUser(this.app, `Error uploading image: ${response.status}`).open();
						}
					} catch (error) {
						new NotifyUser(this.app, `Exception while uploading image: ${error}`).open();
					}
				} else {
					new NotifyUser(this.app, `File not found in vault: ${ref}`).open();
				}
			} else {
				new NotifyUser(this.app, `Unable to resolve file path for: ${ref}`).open();
			}
		}
		return imageUrls;
	}

	async postTopic(): Promise<{ message: string; error?: string }> {
		const url = `${this.settings.baseUrl}/posts.json`;
		const headers = {
			"Content-Type": "application/json",
			"Api-Key": this.settings.apiKey,
			"Api-Username": this.settings.disUser,
		}
		let content = this.activeFile.content;

		// 检查是否包含帖子ID的frontmatter
		const frontMatter = this.getFrontMatter(content);
		const postId = frontMatter?.discourse_post_id;
		
		// 过滤掉笔记属性部分
		content = content.replace(/^---[\s\S]*?---\n/, '');

		const imageReferences = this.extractImageReferences(content);
		const imageUrls = await this.uploadImages(imageReferences);

		imageReferences.forEach((ref, index) => {
			const obsRef = `![[${ref}]]`;
			const discoRef = `![${ref}](${imageUrls[index]})`;
			content = content.replace(obsRef, discoRef);
		});

		const isUpdate = postId !== undefined;
		const endpoint = isUpdate ? `${this.settings.baseUrl}/posts/${postId}` : url;
		const method = isUpdate ? "PUT" : "POST";

		const body = JSON.stringify(isUpdate ? {
			raw: content,
			edit_reason: "Updated from Obsidian"
		} : {
			title: this.activeFile.name,
			raw: content,
			category: this.settings.category
		});

		try {
			const response = await requestUrl({
				url: endpoint,
				method: method,
				contentType: "application/json",
				body,
				headers,
				throw: false
			});

			if (response.status === 200) {
				if (!isUpdate) {
					try {
						// 获取新帖子的ID
						const responseData = response.json;
						if (responseData && responseData.id) {
							await this.updateFrontMatter(responseData.id);
						} else {
							return {
								message: "Error",
								error: "发布成功但无法获取帖子ID"
							};
						}
					} catch (error) {
						return {
							message: "Error",
							error: "发布成功但无法保存帖子ID"
						};
					}
				}
				return { message: "Success" };
			} else {
				try {
					const errorResponse = response.json;
					if (errorResponse.errors && errorResponse.errors.length > 0) {
						return { 
							message: "Error",
							error: errorResponse.errors.join('\n')
						};
					}
					if (errorResponse.error) {
						return {
							message: "Error",
							error: errorResponse.error
						};
					}
				} catch (parseError) {
					return {
						message: "Error",
						error: `${isUpdate ? '更新' : '发布'}失败 (${response.status})`
					};
				}
			}
		} catch (error) {
			return { 
				message: "Error",
				error: `${isUpdate ? '更新' : '发布'}失败: ${error.message || '未知错误'}`
			};
		}
		return { message: "Error", error: `${isUpdate ? '更新' : '发布'}失败，请重试` };
	}

	// 获取frontmatter数据
	private getFrontMatter(content: string): any {
		const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (fmMatch) {
			try {
				return yaml.parse(fmMatch[1]);
			} catch (e) {
				return null;
			}
		}
		return null;
	}

	// 更新frontmatter，添加帖子ID
	private async updateFrontMatter(postId: number) {
		try {
			// 获取当前活动文件
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile) {
				console.error('No active file found');
				return;
			}

			const content = await this.app.vault.read(activeFile);
			const fm = this.getFrontMatter(content);
			
			let newContent: string;
			if (fm) {
				// 更新现有的frontmatter
				const updatedFm = { ...fm, discourse_post_id: postId };
				newContent = content.replace(/^---\n[\s\S]*?\n---\n/, `---\n${yaml.stringify(updatedFm)}---\n`);
			} else {
				// 添加新的frontmatter
				const newFm = { discourse_post_id: postId };
				newContent = `---\n${yaml.stringify(newFm)}---\n${content}`;
			}
			
			await this.app.vault.modify(activeFile, newContent);
			console.log('Successfully updated frontmatter with post ID:', postId);
		} catch (error) {
			console.error('Error updating frontmatter:', error);
		}
	}

	private async fetchCategories() {
		const url = `${this.settings.baseUrl}/categories.json?include_subcategories=true`;
		const headers = {
			"Content-Type": "application/json",
			"Api-Key": this.settings.apiKey,
			"Api-Username": this.settings.disUser,
		};

		try {
			const response = await requestUrl({
				url: url,
				method: "GET",
				contentType: "application/json",
				headers,
			});


			const data = await response.json;
			const categories = data.category_list.categories;
			const allCategories = categories.flatMap((category: Category) => {
				const subcategories: { id: number; name: string }[] = category.subcategory_list?.map((sub: Subcategory) => ({
					id: sub.id,
					name: sub.name,
				})) || [];
				return [
					{ id: category.id, name: category.name },
					...subcategories,
				];
			});
			return allCategories;
		} catch (error) {
			return [];
		}
	}

	registerDirMenu(menu: Menu, file: TFile) {
		const syncDiscourse = (item: MenuItem) => {
			item.setTitle("发布到 Discourse");
			item.onClick(async () => {
				const content = await this.app.vault.read(file);
				const fm = this.getFrontMatter(content);
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

	private async openCategoryModal() {
		const categories = await this.fetchCategories();
		if (categories.length > 0) {
			new SelectCategoryModal(this.app, this, categories).open();
		}
	}

	private async syncToDiscourse() {
		await this.openCategoryModal();
	}

	onunload() {}

}

interface Subcategory {
	id: number;
	name: string;
}

interface Category {
	id: number;
	name: string;
	subcategory_list?: Subcategory[];
}

const genBoundary = (): string => {
	return '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);
}


export class NotifyUser extends Modal {
	message: string;
	constructor(app: App, message: string) {
		super(app);
		this.message = message;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h1", { text: 'An error has occurred.' });
		contentEl.createEl("h4", { text: this.message });
		const okButton = contentEl.createEl('button', { text: 'Ok' });
		okButton.onclick = () => {
			this.close();
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

}

export class SelectCategoryModal extends Modal {
	plugin: DiscourseSyncPlugin;
	categories: {id: number; name: string}[];
	constructor(app: App, plugin: DiscourseSyncPlugin, categories: {id: number; name: string }[]) {
		super(app);
		this.plugin = plugin;
		this.categories = categories;
	}

	onOpen() {
		// 添加模态框基础样式
		this.modalEl.addClass('mod-discourse-sync');
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('discourse-sync-modal');

		const isUpdate = this.plugin.activeFile.postId !== undefined;
		contentEl.createEl("h1", { text: isUpdate ? '更新帖子' : '发布到 Discourse' });
		
		// 创建选择器容器
		const selectContainer = contentEl.createEl('div', { cls: 'select-container' });
		if (!isUpdate) {
			// 只在新建帖子时显示分类选择
			selectContainer.createEl('label', { text: '分类' });
			const selectEl = selectContainer.createEl('select');
			this.categories.forEach(category => {
				const option = selectEl.createEl('option', { text: category.name });
				option.value = category.id.toString();
			});
		}

		const submitButton = contentEl.createEl('button', { 
			text: isUpdate ? '更新' : '发布',
			cls: 'submit-button'
		});

		// 创建提示信息容器
		const noticeContainer = contentEl.createEl('div');
		
		submitButton.onclick = async () => {
			if (!isUpdate) {
				const selectEl = contentEl.querySelector('select') as HTMLSelectElement;
				if (!selectEl) {
					return;
				}
				const selectedCategoryId = selectEl.value;
				this.plugin.settings.category = parseInt(selectedCategoryId);
				await this.plugin.saveSettings();
			}
			
			// 禁用提交按钮，显示加载状态
			submitButton.disabled = true;
			submitButton.textContent = isUpdate ? '更新中...' : '发布中...';
			
			try {
				const reply = await this.plugin.postTopic();
				
				// 显示提示信息
				noticeContainer.empty();
				if (reply.message === 'Success') {
					noticeContainer.createEl('div', { 
						cls: 'notice success',
						text: isUpdate ? '✓ 更新成功！' : '✓ 发布成功！'
					});
					// 成功后延迟关闭
					setTimeout(() => {
						this.close();
					}, 1500);
				} else {
					const errorContainer = noticeContainer.createEl('div', { cls: 'notice error' });
					errorContainer.createEl('div', { 
						cls: 'error-title',
						text: isUpdate ? '更新失败' : '发布失败'
					});
					
					// 显示 Discourse 返回的具体错误信息
					errorContainer.createEl('div', { 
						cls: 'error-message',
						text: reply.error || (isUpdate ? '更新失败，请重试' : '发布失败，请重试')
					});
					
					// 添加重试按钮
					const retryButton = errorContainer.createEl('button', {
						cls: 'retry-button',
						text: '重试'
					});
					retryButton.onclick = () => {
						noticeContainer.empty();
						submitButton.disabled = false;
						submitButton.textContent = isUpdate ? '更新' : '发布';
					};
				}
			} catch (error) {
				noticeContainer.empty();
				const errorContainer = noticeContainer.createEl('div', { cls: 'notice error' });
				errorContainer.createEl('div', { 
					cls: 'error-title',
					text: isUpdate ? '更新出错' : '发布出错'
				});
				errorContainer.createEl('div', { 
					cls: 'error-message',
					text: error.message || '未知错误'
				});
				
				// 添加重试按钮
				const retryButton = errorContainer.createEl('button', {
					cls: 'retry-button',
					text: '重试'
				});
				retryButton.onclick = () => {
					noticeContainer.empty();
					submitButton.disabled = false;
					submitButton.textContent = isUpdate ? '更新' : '发布';
				};
			}
			
			// 如果发生错误，重置按钮状态
			if (submitButton.disabled) {
				submitButton.disabled = false;
				submitButton.textContent = isUpdate ? '更新' : '发布';
			}
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
