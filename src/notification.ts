import { App, Modal } from 'obsidian';

// 通知用户的模态框
export class NotifyUser extends Modal {
    message: string;
    constructor(app: App, message: string) {
        super(app);
        this.message = message;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.setText(this.message);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 