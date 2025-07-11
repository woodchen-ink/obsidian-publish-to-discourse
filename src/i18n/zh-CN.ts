export default {
    // 设置页面
    'FORUM_URL': '论坛地址',
    'FORUM_URL_DESC': 'Discourse 论坛的网址',

    'SKIP_H1': '跳过一级标题',
    'SKIP_H1_DESC': '发布到 Discourse 时跳过笔记中的一级标题',
    'TEST_API_KEY': '测试连接',
    'TESTING': '测试中...',
    'API_TEST_SUCCESS': '连接成功！API密钥有效',
    'API_TEST_FAILED': 'API密钥测试失败',
    'MISSING_SETTINGS': '请先填写论坛地址和User-Api-Key',

    // 发布页面
    'PUBLISH_TO_DISCOURSE': '发布到 Discourse',
    'UPDATE_POST': '更新帖子',
    'CATEGORY': '分类',
    'TAGS': '标签',
    'ENTER_TAG': '输入标签名称（回车添加）',
    'ENTER_TAG_WITH_CREATE': '输入标签名称（可创建新标签）',
    'PUBLISHING': '发布中...',
    'UPDATING': '更新中...',
    'PUBLISH': '发布',
    'UPDATE': '更新',
    'RETRY': '重试',

    // 成功提示
    'PUBLISH_SUCCESS': '✓ 发布成功！',
    'UPDATE_SUCCESS': '✓ 更新成功！',

    // 错误提示
    'PUBLISH_FAILED': '发布失败',
    'UPDATE_FAILED': '更新失败',
    'PUBLISH_ERROR': '发布出错',
    'UPDATE_ERROR': '更新出错',
    'PERMISSION_ERROR': '权限不足，只能使用已有的标签',
    'UNKNOWN_ERROR': '未知错误',
    'TRY_AGAIN': '请重试',
    'POST_ID_ERROR': '发布成功但无法获取帖子ID',
    'SAVE_POST_ID_ERROR': '发布成功但无法保存帖子ID',
    // crypto.ts error messages
    'CRYPTO_NEED_GEN_KEYPAIR': '请先生成密钥对',
    'CRYPTO_PAYLOAD_NO_KEY': 'payload内容无key字段',
    'CRYPTO_NONCE_INVALID': 'nonce校验失败',

    // Open in Discourse
    'OPEN_IN_DISCOURSE': '在 Discourse 中打开',
    'NO_ACTIVE_FILE': '没有打开的文件',
    'NO_TOPIC_ID': '此笔记尚未发布到 Discourse',

    // 分类冲突
    'CATEGORY_CONFLICT_TITLE': '分类冲突',
    'CATEGORY_CONFLICT_DESC': '检测到本地设置的分类与 Discourse 上的分类不同，请选择要使用的分类：',
    'LOCAL_CATEGORY': '本地分类（frontmatter中设置）',
    'REMOTE_CATEGORY': '远程分类（Discourse上的分类）',
    'KEEP_LOCAL_CATEGORY': '保持本地分类',
    'USE_REMOTE_CATEGORY': '使用远程分类',

    // 配置页面
    'CONFIG_BASIC_TITLE': '基础配置',
    'CONFIG_BASIC_DESC': '设置 Discourse 论坛的基本信息',
    'CONFIG_API_TITLE': '获取 User-API-Key',
    'CONFIG_API_DESC': '通过 Discourse 官方授权流程获取 API 密钥，请按照以下步骤操作：',
    'CONFIG_PUBLISH_TITLE': '发布选项',
    'CONFIG_PUBLISH_DESC': '自定义发布到 Discourse 时的行为',
    'STEP_VERIFY_URL': '步骤 1: 确认论坛地址',
    'STEP_VERIFY_URL_DESC': '请确保上面的论坛地址是正确的，然后继续下一步',
    'STEP_GENERATE_AUTH': '步骤 2: 生成授权链接',
    'STEP_GENERATE_AUTH_DESC': '点击下面的按钮生成授权链接，并跳转到 Discourse 授权页面：',
    'STEP_AUTHORIZE': '步骤 3: 完成授权并复制 Payload',
    'STEP_AUTHORIZE_DESC': '在 Discourse 授权页面点击 Authorize 后，会显示一个 payload 文本框，请复制其中的内容：',
    'STEP_DECRYPT': '步骤 4: 解密并保存 User-API-Key',
    'STEP_DECRYPT_DESC': '将复制的 payload 粘贴到下面的输入框中，然后点击"解密并保存"：',
    'STEP_TEST': '步骤 5: 测试连接',
    'STEP_TEST_DESC': '验证 User-API-Key 是否配置正确：',
    'GENERATE_AUTH_LINK': '生成授权链接',
    'GENERATE_AUTH_DESC': '生成密钥对并跳转到 Discourse 授权页面',
    'DECRYPT_PAYLOAD': '解密授权结果',
    'DECRYPT_PAYLOAD_DESC': '粘贴从 Discourse 授权页面复制的 payload',
    'PAYLOAD_PLACEHOLDER': '粘贴 payload (base64 格式)',
    'DECRYPT_AND_SAVE': '解密并保存',
    'AUTH_LINK_GENERATED': '已生成密钥对并跳转授权页面，请在授权页面点击 Authorize 按钮。',
    'DECRYPT_SUCCESS': '✅ User-Api-Key解密成功！',
    'DECRYPT_FAILED': '❌ User-Api-Key解密失败: ',
    'USER_API_KEY': 'User-API-Key',
    'USER_API_KEY_DESC': '当前配置的 User-API-Key（只读）',
    'USER_API_KEY_EMPTY': '请使用下面的流程获取',
    'COPY_API_KEY': '复制',
    'API_KEY_COPIED': '✅ API Key 已复制到剪贴板',

    // 版本更新提示
    'UPDATE_NOTICE_TITLE': '🔄 插件已更新 - 需要重新配置',
    'UPDATE_NOTICE_MESSAGE': '由于认证方式的重大变化，您需要重新配置 User-API-Key。旧的 API Key 和用户名方式已被移除，请前往设置页面重新配置。',
    'UPDATE_NOTICE_BUTTON': '前往设置',
    'UPDATE_NOTICE_DISMISS': '我知道了'
} 