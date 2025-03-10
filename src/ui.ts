import { App, Modal } from 'obsidian';
import { t } from './i18n';
import { PluginInterface } from './types';

// 选择分类的模态框
export class SelectCategoryModal extends Modal {
    plugin: PluginInterface;
    categories: {id: number; name: string}[];
    tags: { name: string; canCreate: boolean }[];
    canCreateTags = false;

    constructor(app: App, plugin: PluginInterface, categories: {id: number; name: string }[], tags: { name: string; canCreate: boolean }[]) {
        super(app);
        this.plugin = plugin;
        this.categories = categories;
        this.tags = tags;
        this.canCreateTags = tags.length > 0 && tags[0].canCreate;
    }

    onOpen() {
        // 添加模态框基础样式
        this.modalEl.addClass('mod-discourse-sync');
        
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('discourse-sync-modal');
        
        const isUpdate = this.plugin.activeFile.postId !== undefined;
        contentEl.createEl('h1', { text: isUpdate ? t('UPDATE_POST') : t('PUBLISH_TO_DISCOURSE') });

        // 创建表单区域容器
        const formArea = contentEl.createEl('div', { cls: 'form-area' });

        // 创建分类选择容器
        const selectContainer = formArea.createEl('div', { cls: 'select-container' });
        selectContainer.createEl('label', { text: t('CATEGORY') });
        const selectEl = selectContainer.createEl('select');
        
        // 添加分类选项
        this.categories.forEach(category => {
            const option = selectEl.createEl('option', { text: category.name });
            option.value = category.id.toString();
        });
        
        // 设置默认选中的分类
        selectEl.value = this.plugin.settings.category?.toString() || this.categories[0].id.toString();
        
        // 监听分类选择变化
        selectEl.onchange = () => {
            this.plugin.settings.category = parseInt(selectEl.value);
            this.plugin.saveSettings();
        };

        // 创建标签容器
        const tagContainer = formArea.createEl('div', { cls: 'tag-container' });
        tagContainer.createEl('label', { text: t('TAGS') });
        
        // 创建标签选择区域
        const tagSelectArea = tagContainer.createEl('div', { cls: 'tag-select-area' });
        
        // 已选标签显示区域
        const selectedTagsContainer = tagSelectArea.createEl('div', { cls: 'selected-tags' });
        const selectedTags = new Set<string>();
        
        // 初始化已选标签
        if (this.plugin.activeFile.tags && this.plugin.activeFile.tags.length > 0) {
            this.plugin.activeFile.tags.forEach(tag => selectedTags.add(tag));
        }
        
        // 更新标签显示
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
        
        // 初始化标签显示
        updateSelectedTags();
        
        // 创建标签输入容器
        const tagInputContainer = tagSelectArea.createEl('div', { cls: 'tag-input-container' });
        
        // 创建标签输入和建议
        const tagInput = tagInputContainer.createEl('input', {
            type: 'text',
            placeholder: this.canCreateTags ? t('ENTER_TAG_WITH_CREATE') : t('ENTER_TAG')
        });
        
        // 创建标签建议容器
        const tagSuggestions = tagInputContainer.createEl('div', { cls: 'tag-suggestions' });
        
        // 处理输入事件，显示匹配的标签
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
                    // 获取输入框位置和宽度
                    const inputRect = tagInput.getBoundingClientRect();
                    const modalRect = this.modalEl.getBoundingClientRect();
                    
                    // 确保建议列表不超过模态框宽度
                    const maxWidth = modalRect.right - inputRect.left - 24; // 24px是右边距
                    
                    // 设置建议列表位置和宽度
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
        
        // 处理回车事件
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
                        // 显示权限提示
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
        
        // 处理失焦事件，隐藏建议
        tagInput.onblur = () => {
            // 延迟隐藏，以便可以点击建议
            setTimeout(() => {
                tagSuggestions.empty();
            }, 200);
        };
        
        // 处理窗口滚动，更新建议列表位置
        const updateSuggestionsPosition = () => {
            if (tagSuggestions.childNodes.length > 0) {
                const inputRect = tagInput.getBoundingClientRect();
                tagSuggestions.style.top = `${inputRect.bottom + 4}px`;
                tagSuggestions.style.left = `${inputRect.left}px`;
                tagSuggestions.style.width = `${inputRect.width}px`;
            }
        };
        
        // 监听滚动事件
        this.modalEl.addEventListener('scroll', updateSuggestionsPosition);
        
        // 模态框关闭时移除事件监听器
        this.modalEl.onclose = () => {
            this.modalEl.removeEventListener('scroll', updateSuggestionsPosition);
        };
        
        // 创建按钮区域
        const buttonArea = contentEl.createEl('div', { cls: 'button-area' });
        const submitButton = buttonArea.createEl('button', { 
            text: isUpdate ? t('UPDATE') : t('PUBLISH'),
            cls: 'submit-button'
        });
        
        // 创建通知容器
        const noticeContainer = buttonArea.createEl('div', { cls: 'notice-container' });
        
        submitButton.onclick = async () => {
            // 保存当前选择的标签到activeFile对象
            this.plugin.activeFile.tags = Array.from(selectedTags);
            
            // 禁用提交按钮，显示加载状态
            submitButton.disabled = true;
            submitButton.textContent = isUpdate ? t('UPDATING') : t('PUBLISHING');
            
            try {
                // 发布主题
                const result = await this.plugin.publishTopic();
                
                // 显示结果
                noticeContainer.empty();
                
                if (result.success) {
                    // 成功
                    noticeContainer.createEl('div', { 
                        cls: 'notice success',
                        text: isUpdate ? t('UPDATE_SUCCESS') : t('PUBLISH_SUCCESS')
                    });
                    
                    // 2秒后自动关闭
                    setTimeout(() => {
                        this.close();
                    }, 2000);
                } else {
                    // 失败
                    const errorContainer = noticeContainer.createEl('div', { cls: 'notice error' });
                    errorContainer.createEl('div', { 
                        cls: 'error-title',
                        text: isUpdate ? t('UPDATE_ERROR') : t('PUBLISH_ERROR')
                    });
                    
                    errorContainer.createEl('div', { 
                        cls: 'error-message',
                        text: result.error || t('UNKNOWN_ERROR')
                    });
                    
                    // 添加重试按钮
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
                // 显示错误
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
                
                // 添加重试按钮
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
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 