import { App, Menu, MenuItem, Plugin, Modal, requestUrl, TFile, moment } from 'obsidian';
import { DEFAULT_SETTINGS, DiscourseSyncSettings, DiscourseSyncSettingsTab } from './config';
import * as yaml from 'yaml';
import { t, setLocale } from './i18n';

export default class DiscourseSyncPlugin extends Plugin {
	settings: DiscourseSyncSettings;
	activeFile: { 
		name: string; 
		content: string;
		postId?: number; // Post ID field
	};
	async onload() {
		// Set locale based on Obsidian's language setting
		setLocale(moment.locale());

		// Update locale when Obsidian's language changes
		this.registerEvent(
			this.app.workspace.on('window-open', () => {
				setLocale(moment.locale());
			})
		);

		await this.loadSettings();
		this.addSettingTab(new DiscourseSyncSettingsTab(this.app, this));
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file: TFile) => {
				this.registerDirMenu(menu, file);
			}),
		);

		this.addCommand({
			id: "category-modal",
			name: t('PUBLISH_TO_DISCOURSE'),
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

		// Check if frontmatter contains post ID
		const frontMatter = this.getFrontMatter(content);
		const postId = frontMatter?.discourse_post_id;
		
		// Filter out note properties section
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
			edit_reason: "Updated from Obsidian",
			tags: this.settings.selectedTags || []
		} : {
			title: this.activeFile.name,
			raw: content,
			category: this.settings.category,
			tags: this.settings.selectedTags || []
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
						// Get new post ID
						const responseData = response.json;
						if (responseData && responseData.id) {
							await this.updateFrontMatter(responseData.id);
						} else {
							return {
								message: "Error",
								error: t('POST_ID_ERROR')
							};
						}
					} catch (error) {
						return {
							message: "Error",
							error: t('SAVE_POST_ID_ERROR')
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
						error: `${isUpdate ? t('UPDATE_FAILED') : t('PUBLISH_FAILED')} (${response.status})`
					};
				}
			}
		} catch (error) {
			return { 
				message: "Error",
				error: `${isUpdate ? t('UPDATE_FAILED') : t('PUBLISH_FAILED')}: ${error.message || t('UNKNOWN_ERROR')}`
			};
		}
		return { message: "Error", error: `${isUpdate ? t('UPDATE_FAILED') : t('PUBLISH_FAILED')}, ${t('TRY_AGAIN')}` };
	}

	// Get frontmatter data
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

	// Update frontmatter, add post ID
	private async updateFrontMatter(postId: number) {
		try {
			// Get current active file
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile) {
				return;
			}

			const content = await this.app.vault.read(activeFile);
			const fm = this.getFrontMatter(content);
			
			let newContent: string;
			if (fm) {
				// Update existing frontmatter
				const updatedFm = { ...fm, discourse_post_id: postId };
				newContent = content.replace(/^---\n[\s\S]*?\n---\n/, `---\n${yaml.stringify(updatedFm)}---\n`);
			} else {
				// Add new frontmatter
				const newFm = { discourse_post_id: postId };
				newContent = `---\n${yaml.stringify(newFm)}---\n${content}`;
			}
			
			await this.app.vault.modify(activeFile, newContent);
		} catch (error) {
			return {
				message: "Error",
				error: t('UPDATE_FAILED')
			};
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

	private async fetchTags(): Promise<{ name: string; canCreate: boolean }[]> {
		const url = `${this.settings.baseUrl}/tags.json`;
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

			if (response.status === 200) {
				const data = response.json;
				// Get user permissions
				const canCreateTags = await this.checkCanCreateTags();
				// Tags list returned by Discourse is in the tags array
				return data.tags.map((tag: any) => ({
					name: tag.name,
					canCreate: canCreateTags
				}));
			}
			return [];
		} catch (error) {
			return [];
		}
	}

	// Check if user has permission to create tags
	private async checkCanCreateTags(): Promise<boolean> {
		try {
			const url = `${this.settings.baseUrl}/u/${this.settings.disUser}.json`;
			const headers = {
				"Content-Type": "application/json",
				"Api-Key": this.settings.apiKey,
				"Api-Username": this.settings.disUser,
			};

			const response = await requestUrl({
				url: url,
				method: "GET",
				contentType: "application/json",
				headers,
			});

			if (response.status === 200) {
				const data = response.json;
				// Check user's trust_level
				return data.user.trust_level >= 3;
			}
			return false;
		} catch (error) {
			return false;
		}
	}

	registerDirMenu(menu: Menu, file: TFile) {
		const syncDiscourse = (item: MenuItem) => {
			item.setTitle(t('PUBLISH_TO_DISCOURSE'));
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
		const [categories, tags] = await Promise.all([
			this.fetchCategories(),
			this.fetchTags()
		]);
		if (categories.length > 0) {
			new SelectCategoryModal(this.app, this, categories, tags).open();
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
	tags: { name: string; canCreate: boolean }[];
	canCreateTags = false;

	constructor(app: App, plugin: DiscourseSyncPlugin, categories: {id: number; name: string }[], tags: { name: string; canCreate: boolean }[]) {
		super(app);
		this.plugin = plugin;
		this.categories = categories;
		this.tags = tags;
		this.canCreateTags = tags.length > 0 ? tags[0].canCreate : false;
	}

	onOpen() {
		// Add modal base style
		this.modalEl.addClass('mod-discourse-sync');
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('discourse-sync-modal');

		const isUpdate = this.plugin.activeFile.postId !== undefined;
		contentEl.createEl("h1", { text: isUpdate ? t('UPDATE_POST') : t('PUBLISH_TO_DISCOURSE') });
		
		// Create form area container
		const formArea = contentEl.createEl('div', { cls: 'form-area' });
		
		// Create selector container
		const selectContainer = formArea.createEl('div', { cls: 'select-container' });
		if (!isUpdate) {
			// Only show category selector when creating a new post
			selectContainer.createEl('label', { text: t('CATEGORY') });
			const selectEl = selectContainer.createEl('select');
			this.categories.forEach(category => {
				const option = selectEl.createEl('option', { text: category.name });
				option.value = category.id.toString();
			});
		}

		// Create tag selector container
		const tagContainer = formArea.createEl('div', { cls: 'tag-container' });
		tagContainer.createEl('label', { text: t('TAGS') });
		
		// Create tag selector area
		const tagSelectArea = tagContainer.createEl('div', { cls: 'tag-select-area' });
		
		// Selected tags display area
		const selectedTagsContainer = tagSelectArea.createEl('div', { cls: 'selected-tags' });
		const selectedTags = new Set<string>();

		// Update selected tags display
		const updateSelectedTags = () => {
			selectedTagsContainer.empty();
			selectedTags.forEach(tag => {
				const tagEl = selectedTagsContainer.createEl('span', { 
					cls: 'tag',
					text: tag
				});
				const removeBtn = tagEl.createEl('span', {
					cls: 'remove-tag',
					text: '×'
				});
				removeBtn.onclick = () => {
					selectedTags.delete(tag);
					updateSelectedTags();
				};
			});
		};

		// Create tag input container
		const tagInputContainer = tagSelectArea.createEl('div', { cls: 'tag-input-container' });
		
		// Create tag input and suggestions
		const tagInput = tagInputContainer.createEl('input', {
			type: 'text',
			placeholder: this.canCreateTags ? t('ENTER_TAG_WITH_CREATE') : t('ENTER_TAG')
		});

		// Create tag suggestions container
		const tagSuggestions = tagInputContainer.createEl('div', { cls: 'tag-suggestions' });

		// Handle input event, show matching tags
		tagInput.oninput = () => {
			const value = tagInput.value.toLowerCase();
			tagSuggestions.empty();

			if (value) {
				const matches = this.tags
					.filter(tag => 
						tag.name.toLowerCase().includes(value) && 
						!selectedTags.has(tag.name)
					)
					.slice(0, 10);

				if (matches.length > 0) {
					// Get input box position and width
					const inputRect = tagInput.getBoundingClientRect();
					const modalRect = this.modalEl.getBoundingClientRect();
					
					// Ensure suggestions list doesn't exceed modal width
					const maxWidth = modalRect.right - inputRect.left - 24; // 24px is right padding
					
					// Set suggestions list position and width
					tagSuggestions.style.top = `${inputRect.bottom + 4}px`;
					tagSuggestions.style.left = `${inputRect.left}px`;
					tagSuggestions.style.width = `${Math.min(inputRect.width, maxWidth)}px`;

					matches.forEach(tag => {
						const suggestion = tagSuggestions.createEl('div', {
							cls: 'tag-suggestion',
							text: tag.name
						});
						suggestion.onclick = () => {
							selectedTags.add(tag.name);
							tagInput.value = '';
							tagSuggestions.empty();
							updateSelectedTags();
						};
					});
				}
			}
		};

		// Handle enter event
		tagInput.onkeydown = (e) => {
			if (e.key === 'Enter' && tagInput.value) {
				e.preventDefault();
				const value = tagInput.value.trim();
				if (value && !selectedTags.has(value)) {
					const existingTag = this.tags.find(t => t.name.toLowerCase() === value.toLowerCase());
					if (existingTag) {
						selectedTags.add(existingTag.name);
						updateSelectedTags();
					} else if (this.canCreateTags) {
						selectedTags.add(value);
						updateSelectedTags();
					} else {
						// Show permission notice
						const notice = contentEl.createEl('div', {
							cls: 'tag-notice',
							text: t('PERMISSION_ERROR')
						});
						setTimeout(() => {
							notice.remove();
						}, 2000);
					}
				}
				tagInput.value = '';
				tagSuggestions.empty();
			}
		};

		// Handle blur event, hide suggestions
		tagInput.onblur = () => {
			// Delay hide, so suggestions can be clicked
			setTimeout(() => {
				tagSuggestions.empty();
			}, 200);
		};

		// Handle window scroll, update suggestions list position
		const updateSuggestionsPosition = () => {
			if (tagSuggestions.childNodes.length > 0) {
				const inputRect = tagInput.getBoundingClientRect();
				tagSuggestions.style.top = `${inputRect.bottom + 4}px`;
				tagSuggestions.style.left = `${inputRect.left}px`;
				tagSuggestions.style.width = `${inputRect.width}px`;
			}
		};

		// Listen for scroll event
		this.modalEl.addEventListener('scroll', updateSuggestionsPosition);
		
		// Remove event listeners when modal closes
		this.modalEl.onclose = () => {
			this.modalEl.removeEventListener('scroll', updateSuggestionsPosition);
		};

		// Create button area
		const buttonArea = contentEl.createEl('div', { cls: 'button-area' });
		const submitButton = buttonArea.createEl('button', { 
			text: isUpdate ? t('UPDATE') : t('PUBLISH'),
			cls: 'submit-button'
		});

		// Create notice container
		const noticeContainer = buttonArea.createEl('div');
		
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
			
			// Save selected tags
			this.plugin.settings.selectedTags = Array.from(selectedTags);
			await this.plugin.saveSettings();
			
			// Disable submit button, show loading state
			submitButton.disabled = true;
			submitButton.textContent = isUpdate ? t('UPDATING') : t('PUBLISHING');
			
			try {
				const reply = await this.plugin.postTopic();
				
				// Show notice
				noticeContainer.empty();
				if (reply.message === 'Success') {
					noticeContainer.createEl('div', { 
						cls: 'notice success',
						text: isUpdate ? t('UPDATE_SUCCESS') : t('PUBLISH_SUCCESS')
					});
					// Close after success
					setTimeout(() => {
						this.close();
					}, 1500);
				} else {
					const errorContainer = noticeContainer.createEl('div', { cls: 'notice error' });
					errorContainer.createEl('div', { 
						cls: 'error-title',
						text: isUpdate ? t('UPDATE_ERROR') : t('PUBLISH_ERROR')
					});
					
					// Show Discourse-specific error information
					errorContainer.createEl('div', { 
						cls: 'error-message',
						text: reply.error || (isUpdate ? t('UPDATE_FAILED') + ', ' + t('TRY_AGAIN') : t('PUBLISH_FAILED') + ', ' + t('TRY_AGAIN'))
					});
					
					// Add retry button
					const retryButton = errorContainer.createEl('button', {
						cls: 'retry-button',
						text: t('RETRY')
					});
					retryButton.onclick = () => {
						noticeContainer.empty();
						submitButton.disabled = false;
						submitButton.textContent = isUpdate ? t('UPDATE') : t('PUBLISH');
					};
				}
			} catch (error) {
				noticeContainer.empty();
				const errorContainer = noticeContainer.createEl('div', { cls: 'notice error' });
				errorContainer.createEl('div', { 
					cls: 'error-title',
					text: isUpdate ? t('UPDATE_ERROR') : t('PUBLISH_ERROR')
				});
				errorContainer.createEl('div', { 
					cls: 'error-message',
					text: error.message || t('UNKNOWN_ERROR')
				});
				
				// Add retry button
				const retryButton = errorContainer.createEl('button', {
					cls: 'retry-button',
					text: t('RETRY')
				});
				retryButton.onclick = () => {
					noticeContainer.empty();
					submitButton.disabled = false;
					submitButton.textContent = isUpdate ? t('UPDATE') : t('PUBLISH');
				};
			}
			
			// If error occurs, reset button state
			if (submitButton.disabled) {
				submitButton.disabled = false;
				submitButton.textContent = isUpdate ? t('UPDATE') : t('PUBLISH');
			}
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
