export default {
    // Settings page
    'FORUM_URL': 'Forum URL',
    'FORUM_URL_DESC': 'The URL of your Discourse forum',

    'SKIP_H1': 'Skip First Heading',
    'SKIP_H1_DESC': 'Skip the first heading (H1) when publishing to Discourse',
    'USE_REMOTE_IMAGE_URL': 'Use Remote Image URLs',
    'USE_REMOTE_IMAGE_URL_DESC': 'Replace local image links with remote URLs from Discourse after publishing',
    'TEST_API_KEY': 'Test Connection',
    'TESTING': 'Testing...',
    'API_TEST_SUCCESS': 'Connection successful! API key is valid',
    'API_TEST_FAILED': 'API key test failed',
    'MISSING_SETTINGS': 'Please fill in Forum URL and User-Api-Key first',

    // Publish page
    'PUBLISH_TO_DISCOURSE': 'Publish to Discourse',
    'UPDATE_POST': 'Update Post',
    'CATEGORY': 'Category',
    'TAGS': 'Tags',
    'ENTER_TAG': 'Enter tag name (press Enter to add)',
    'ENTER_TAG_WITH_CREATE': 'Enter tag name (press Enter to add) (can create new tags)',
    'PUBLISHING': 'Publishing...',
    'UPDATING': 'Updating...',
    'PUBLISH': 'Publish',
    'UPDATE': 'Update',
    'RETRY': 'Retry',

    // Success messages
    'PUBLISH_SUCCESS': '✓ Published successfully!',
    'UPDATE_SUCCESS': '✓ Updated successfully!',

    // Error messages
    'PUBLISH_FAILED': 'Publish failed',
    'UPDATE_FAILED': 'Update failed',
    'PUBLISH_ERROR': 'Publish error',
    'UPDATE_ERROR': 'Update error',
    'PERMISSION_ERROR': 'Insufficient permissions, can only use existing tags',
    'UNKNOWN_ERROR': 'Unknown error',
    'TRY_AGAIN': 'Please try again',
    'POST_ID_ERROR': 'Published successfully but failed to get post ID',
    'SAVE_POST_ID_ERROR': 'Published successfully but failed to save post ID',
    // crypto.ts error messages
    'CRYPTO_NEED_GEN_KEYPAIR': 'Please generate the key pair first',
    'CRYPTO_PAYLOAD_NO_KEY': 'No key field in payload',
    'CRYPTO_NONCE_INVALID': 'Nonce validation failed',

    // Open in Discourse
    'OPEN_IN_DISCOURSE': 'Open in Discourse',
    'NO_ACTIVE_FILE': 'No active file',
    'NO_TOPIC_ID': 'This note has not been published to Discourse yet',

    // Category conflict
    'CATEGORY_CONFLICT_TITLE': 'Category Conflict',
    'CATEGORY_CONFLICT_DESC': 'The local category setting differs from the remote category on Discourse. Please choose which category to use:',
    'LOCAL_CATEGORY': 'Local Category (set in frontmatter)',
    'REMOTE_CATEGORY': 'Remote Category (from Discourse)',
    'KEEP_LOCAL_CATEGORY': 'Keep Local Category',
    'USE_REMOTE_CATEGORY': 'Use Remote Category',

    // Configuration page
    'CONFIG_BASIC_TITLE': 'Basic Configuration',
    'CONFIG_BASIC_DESC': 'Set up basic information for your Discourse forum',
    'CONFIG_API_TITLE': 'Get User-API-Key',
    'CONFIG_API_DESC': 'Obtain API key through Discourse official authorization process. Please follow these steps:',
    'CONFIG_PUBLISH_TITLE': 'Publishing Options',
    'CONFIG_PUBLISH_DESC': 'Customize behavior when publishing to Discourse',
    'STEP_VERIFY_URL': 'Step 1: Verify Forum URL',
    'STEP_VERIFY_URL_DESC': 'Please ensure the forum URL above is correct before proceeding to the next step',
    'STEP_GENERATE_AUTH': 'Step 2: Generate Authorization Link',
    'STEP_GENERATE_AUTH_DESC': 'Click the button below to generate authorization link and jump to Discourse authorization page:',
    'STEP_AUTHORIZE': 'Step 3: Complete Authorization and Copy Payload',
    'STEP_AUTHORIZE_DESC': 'After clicking Authorize on Discourse authorization page, a payload text box will appear. Please copy its content:',
    'STEP_DECRYPT': 'Step 4: Decrypt and Save User-API-Key',
    'STEP_DECRYPT_DESC': 'Paste the copied payload into the input box below, then click "Decrypt and Save":',
    'STEP_TEST': 'Step 5: Test Connection',
    'STEP_TEST_DESC': 'Verify that User-API-Key is configured correctly:',
    'GENERATE_AUTH_LINK': 'Generate Authorization Link',
    'GENERATE_AUTH_DESC': 'Generate key pair and redirect to Discourse authorization page',
    'DECRYPT_PAYLOAD': 'Decrypt Authorization Result',
    'DECRYPT_PAYLOAD_DESC': 'Paste the payload copied from Discourse authorization page',
    'PAYLOAD_PLACEHOLDER': 'Paste payload (base64 format)',
    'DECRYPT_AND_SAVE': 'Decrypt and Save',
    'AUTH_LINK_GENERATED': 'Key pair generated and redirecting to authorization page. Please click Authorize button on the authorization page.',
    'DECRYPT_SUCCESS': '✅ User-Api-Key decrypted successfully!',
    'DECRYPT_FAILED': '❌ User-Api-Key decryption failed: ',
    'USER_API_KEY': 'User-API-Key',
    'USER_API_KEY_DESC': 'Current configured User-API-Key (read-only)',
    'USER_API_KEY_EMPTY': 'Please use the process below to obtain one',
    'COPY_API_KEY': 'Copy',
    'API_KEY_COPIED': '✅ API Key copied to clipboard',

    // Version update notice
    'UPDATE_NOTICE_TITLE': '🔄 Plugin Updated - Reconfiguration Required',
    'UPDATE_NOTICE_MESSAGE': 'Due to major changes in authentication method, you need to reconfigure your User-API-Key. The old API Key and username method has been removed. Please go to settings to reconfigure.',
    'UPDATE_NOTICE_BUTTON': 'Go to Settings',
    'UPDATE_NOTICE_DISMISS': 'I understand'
} 