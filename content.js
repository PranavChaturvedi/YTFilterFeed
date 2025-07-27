// content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'filterYouTubeFeed') {
        const apiKey = request.apiKey;
        const userPrompt = request.prompt;
        let filteredCount = 0;
        let totalVideos = 0;

        // Function to make API call to Gemini
        async function getGeminiResponse(videoTitle, videoDescription, userPrompt, apiKey) {
            const chatHistory = [];
            const prompt = `Given the video title: "${videoTitle}" and description: "${videoDescription}", does this video match the user's interest or prompt: "${userPrompt}"? Respond with 'YES' if it matches, and 'NO' if it does not. Provide only 'YES' or 'NO'.`;
            chatHistory.push({ role: "user", parts: [{ text: prompt }] });

            const payload = { contents: chatHistory };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Gemini API error:', errorData);
                    return 'ERROR'; // Indicate an error
                }

                const result = await response.json();
                if (result.candidates && result.candidates.length > 0 &&
                    result.candidates[0].content && result.candidates[0].content.parts &&
                    result.candidates[0].content.parts.length > 0) {
                    const text = result.candidates[0].content.parts[0].text;
                    return text.trim().toUpperCase(); // Should be 'YES' or 'NO'
                } else {
                    console.warn('Unexpected Gemini API response structure:', result);
                    return 'UNKNOWN';
                }
            } catch (error) {
                console.error('Error fetching from Gemini API:', error);
                return 'ERROR';
            }
        }

        // Function to process and filter videos
        async function processVideos() {
            // Selectors for YouTube video elements on the homepage/feed
            // These selectors might need adjustment if YouTube's DOM changes
            const videoElements = document.querySelectorAll(
                'ytd-rich-grid-media, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer'
            );
            totalVideos = videoElements.length;
            let processedVideos = 0;

            if (totalVideos === 0) {
                sendResponse({ status: 'error', message: 'No videos found on the current page.' });
                return;
            }

            for (const videoElement of videoElements) {
                // Check if the video element is already hidden by this extension
                if (videoElement.dataset.filteredByExtension === 'true') {
                    processedVideos++;
                    continue; // Skip already processed videos
                }

                const titleElement = videoElement.querySelector('#video-title, .yt-core-image--fill-parent-height');
                const descriptionElement = videoElement.querySelector('#description-text, #description');

                const videoTitle = titleElement ? (titleElement.textContent || titleElement.alt || '').trim() : '';
                const videoDescription = descriptionElement ? descriptionElement.textContent.trim() : '';

                // Skip if no title is found, as it's essential for filtering
                if (!videoTitle) {
                    processedVideos++;
                    continue;
                }

                console.log(`Processing video: "${videoTitle}"`);

                const geminiResult = await getGeminiResponse(videoTitle, videoDescription, userPrompt, apiKey);

                if (geminiResult === 'YES') {
                    // Keep the video visible
                    videoElement.style.display = ''; // Ensure it's visible
                    console.log(`Keeping video: "${videoTitle}" (Matches prompt)`);
                } else if (geminiResult === 'NO') {
                    // Hide the video
                    videoElement.style.display = 'none';
                    filteredCount++;
                    console.log(`Hiding video: "${videoTitle}" (Does not match prompt)`);
                } else {
                    // Handle errors or unknown responses (e.g., keep visible but log)
                    console.warn(`Could not determine match for "${videoTitle}". Result: ${geminiResult}. Keeping visible.`);
                    videoElement.style.display = ''; // Ensure it's visible
                }
                videoElement.dataset.filteredByExtension = 'true'; // Mark as processed
                processedVideos++;
            }
            sendResponse({ status: 'success', filteredCount: filteredCount });
        }

        processVideos();
        // Return true to indicate that sendResponse will be called asynchronously
        return true;
    }
});
