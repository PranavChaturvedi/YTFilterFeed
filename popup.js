// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const promptInput = document.getElementById('prompt');
    const saveSettingsButton = document.getElementById('saveSettings');
    const filterFeedButton = document.getElementById('filterFeed');
    const statusMessageDiv = document.getElementById('statusMessage');

    // Function to display status messages
    function showStatus(message, type) {
        statusMessageDiv.textContent = message;
        statusMessageDiv.className = `status-message ${type}`;
        statusMessageDiv.classList.remove('hidden');
        setTimeout(() => {
            statusMessageDiv.classList.add('hidden');
        }, 3000); // Hide after 3 seconds
    }

    // Load saved settings when the popup opens
    chrome.storage.sync.get(['geminiApiKey', 'filterPrompt'], (result) => {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
        }
        if (result.filterPrompt) {
            promptInput.value = result.filterPrompt;
        }
    });

    // Save settings when the "Save Settings" button is clicked
    saveSettingsButton.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        const prompt = promptInput.value.trim();

        if (!apiKey) {
            showStatus('Please enter a Gemini API Key.', 'status-error');
            return;
        }
        if (!prompt) {
            showStatus('Please enter a filtering prompt.', 'status-error');
            return;
        }

        chrome.storage.sync.set({ geminiApiKey: apiKey, filterPrompt: prompt }, () => {
            showStatus('Settings saved successfully!', 'status-success');
        });
    });

    // Filter feed when the "Filter Feed" button is clicked
    filterFeedButton.addEventListener('click', () => {
        chrome.storage.sync.get(['geminiApiKey', 'filterPrompt'], (result) => {
            const apiKey = result.geminiApiKey;
            const prompt = result.filterPrompt;

            if (!apiKey || !prompt) {
                showStatus('Please save your API Key and Prompt first.', 'status-error');
                return;
            }

            // Get the active tab and send a message to its content script
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].url.startsWith('https://www.youtube.com/')) {
                    showStatus('Filtering in progress...', 'status-info');
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'filterYouTubeFeed',
                        apiKey: apiKey,
                        prompt: prompt
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            showStatus('Error: Could not connect to YouTube tab. Make sure you are on a YouTube page.', 'status-error');
                            console.error(chrome.runtime.lastError);
                        } else if (response && response.status === 'success') {
                            showStatus(`Filtered ${response.filteredCount} videos.`, 'status-success');
                        } else if (response && response.status === 'error') {
                            showStatus(`Filtering failed: ${response.message}`, 'status-error');
                        } else {
                            showStatus('Filtering initiated. Check YouTube page for results.', 'status-info');
                        }
                    });
                } else {
                    showStatus('Please navigate to a YouTube page to filter the feed.', 'status-error');
                }
            });
        });
    });
});
