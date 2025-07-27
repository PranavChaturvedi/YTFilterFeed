// content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'filterYouTubeFeed') {
        const apiKey = request.apiKey;
        const userPrompt = request.prompt;
        let filteredCount = 0;
        let totalVideosProcessed = 0; // Track videos processed
        let videosFound = 0; // Track videos initially found

        console.log('YouTube Feed Filter: Message received to filter feed.');

        // Function to make API call to Gemini
        async function getGeminiResponse(videoTitle, userPrompt) {
            const chatHistory = [];
            // Refined prompt for better clarity and explicit YES/NO instruction
            const prompt = `Evaluate if the following YouTube video title should be removed for its relevance to the user's interest.
            User's Interest/Prompt: "${userPrompt}"
            Video Title: "${videoTitle}"
            
            Based on the user's interest, is this video relevant? Respond with 'YES' if it is relevant, and 'NO' if it is not. Provide only 'YES' or 'NO' as your answer.`;
            chatHistory.push({ role: "user", parts: [{ text: prompt }] });

            const payload = { contents: chatHistory };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json',"X-goog-api-key": apiKey },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Gemini API error (HTTP status ' + response.status + '):', errorData);
                    return 'ERROR'; // Indicate an error
                }

                const result = await response.json();
                if (result.candidates && result.candidates.length > 0 &&
                    result.candidates[0].content && result.candidates[0].content.parts &&
                    result.candidates[0].content.parts.length > 0) {
                    const text = result.candidates[0].content.parts[0].text;
                    const cleanText = text.trim().toUpperCase();
                    console.log(`Gemini response for "${videoTitle}": ${cleanText}`);
                    return cleanText; // Should be 'YES' or 'NO'
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
            videosFound = videoElements.length;

            if (videosFound === 0) {
                sendResponse({ status: 'error', message: 'No videos found on the current page. Try scrolling down to load more.' });
                return; // Exit if no videos are found
            }

            // Use a Promise.allSettled to handle all API calls concurrently
            // and wait for all to complete before sending final response.
            const processingPromises = [];

            for (const videoElement of videoElements) {
                // Skip if the video element is already hidden by this extension
                if (videoElement.dataset.filteredByExtension === 'true') {
                    totalVideosProcessed++;
                    continue;
                }

                // Find title and description elements more broadly
                const titleElement = videoElement.querySelector(
                    'yt-formatted-string#video-title'
                );

                const videoTitle = titleElement ? (titleElement.textContent || titleElement.alt || '').trim() : '';

                // If no title is found, it's likely not a standard video element or an ad we can't process easily.
                if (!videoTitle) {
                    videoElement.dataset.filteredByExtension = 'true'; // Mark as processed to avoid re-checking
                    totalVideosProcessed++;
                    continue;
                }

                processingPromises.push((async () => {
                    const geminiResult = await getGeminiResponse(videoTitle, userPrompt);

                    if (geminiResult === 'NO') {
                        // Keep the video visible
                        videoElement.style.display = ''; // Ensure it's visible
                        videoElement.style.visibility = ''; // Ensure visibility
                        console.log(`Keeping video: "${videoTitle}" (Matches prompt)`);
                    } else if (geminiResult === 'YES') {
                        // Hide the video
                        videoElement.style.display = 'none';
                        videoElement.style.visibility = 'hidden'; // Also set visibility to hidden
                        filteredCount++;
                        console.log(`Hiding video: "${videoTitle}" (Does not match prompt)`);
                    } else {
                        // Handle errors or unknown responses (e.g., keep visible but log)
                        videoElement.style.display = ''; // Ensure it's visible
                        videoElement.style.visibility = '';
                    }
                    videoElement.dataset.filteredByExtension = 'true'; // Mark as processed
                    totalVideosProcessed++;
                })());
            }
            // Wait for all processing promises to settle
            await Promise.allSettled(processingPromises);
            console.log(`Filtering complete. Total videos found: ${videosFound}, Total videos processed: ${totalVideosProcessed}, Videos hidden: ${filteredCount}`);
            sendResponse({ status: 'success', filteredCount: filteredCount, totalVideosFound: videosFound });
        }

        processVideos();
        // Return true to indicate that sendResponse will be called asynchronously
        return true;
    }
});
