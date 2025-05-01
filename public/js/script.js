// Theme switching functionality
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle.querySelector('i');
    const themeText = themeToggle.querySelector('span');

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);

    // Theme toggle click handler
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeButton(newTheme);
    });

    function updateThemeButton(theme) {
        if (theme === 'dark') {
            themeIcon.className = 'fas fa-moon';
            themeText.textContent = 'Dark Mode';
        } else {
            themeIcon.className = 'fas fa-sun';
            themeText.textContent = 'Light Mode';
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const isGitHubPages = window.location.hostname.includes('github.io');
    
    // DOM elements
    const chatBox = document.getElementById('chatBox');
    const userMessage = document.getElementById('userMessage');
    const sendBtn = document.getElementById('sendBtn');
    const endConversationBtn = document.getElementById('endConversation');

    // Config
    const ticketmasterApiKey = '4yFwguTw7s7V3oQ5tBjXLlEBNUMOmijw';
    const MAX_API_RETRIES = 3;
    
    // State
    let userLocation = { city: "New York", country: "United States" };
    let sessionContext = [];
    let concertCache = {};
    let isTyping = false;
    let apiRetryCount = 0;
    let userName = "";
    let isAskingForName = true;
    // Add userAnswers to store answers to bot questions
    let userAnswers = {};
    
    // US cities for fallback
    const usCities = [
        "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", 
        "Philadelphia", "San Diego", "Dallas", "Austin", "Seattle", 
        "Denver", "Boston", "Nashville", "Las Vegas", "Miami"
    ];

    // Initialize and set up listeners
    if (!isGitHubPages) {
        initializeLocation();
    } else {
        console.log("Running on GitHub Pages - using fallback data");
        useRandomUSCity();
    }
    
    sendBtn.addEventListener('click', handleUserMessage);
    userMessage.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleUserMessage();
    });
    
    // Initialize placeholder
    updateInputPlaceholder();

    // Add event listener for end conversation button
    endConversationBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to end this conversation?')) {
            // Clear chat box except for the initial message
            chatBox.innerHTML = `
                <div class="message bot-message">
                    <div class="message-content">
                        Hello! I'm your concert finder assistant. I'd love to get to know you better. What's your name?
                    </div>
                </div>
            `;
            
            // Reset all state
            userName = "";
            isAskingForName = true;
            sessionContext = [];
            concertCache = {};
            
            // Update input placeholder
            updateInputPlaceholder();
            
            // Clear input field
            userMessage.value = '';
            
            // Focus on input
            userMessage.focus();
        }
    });
    // Helper function for API retries
    async function fetchWithRetry(url, retries = MAX_API_RETRIES) {
        try {
            const response = await fetch(url);
            
            if (response.status === 429 && retries > 0) {
                console.log(`Rate limited, retrying... (${retries} left)`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return fetchWithRetry(url, retries - 1);
            }
            
            return response;
        } catch (error) {
            if (retries > 0) {
                console.log(`Network error, retrying... (${retries} left)`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return fetchWithRetry(url, retries - 1);
            }
            throw error;
        }
    }

    // Initialize user's location
    async function initializeLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async position => {
                try {
                    // Get city and country from coordinates
                    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`);
                    const data = await response.json();
                    
                    // Only use US locations
                    if (data.countryName === "United States" || data.countryCode === "US") {
                        userLocation.city = data.city || data.locality || userLocation.city;
                        console.log(`US location: ${userLocation.city}`);
                    } else {
                        useRandomUSCity();
                    }
                    
                    fetchConcerts(userLocation.city);
                } catch (error) {
                    console.error("Location error:", error);
                    useRandomUSCity();
                }
            }, error => {
                useRandomUSCity();
            });
        } else {
            useRandomUSCity();
        }
    }

    // Pick a random US city when needed
    function useRandomUSCity() {
        userLocation.city = usCities[Math.floor(Math.random() * usCities.length)];
        console.log(`Using: ${userLocation.city}, US`);
        
        if (!isAskingForName && userName) {
            const msg = `${userName}, I'll be showing you concerts in ${userLocation.city}, United States. You can ask about concerts in any other US city too!`;
            addMessage(msg, 'bot');
            sessionContext.push({ role: "assistant", content: msg });
        }
        
        fetchConcerts(userLocation.city);
    }

    // Update placeholder based on conversation state
    function updateInputPlaceholder() {
        userMessage.placeholder = isAskingForName ? 
            "Type your name here..." : 
            `Search concerts by artist, city, or date...`;
    }

    // Handle user input
    async function handleUserMessage() {
        const message = userMessage.value.trim();
        if (message === '' || isTyping) return;
        
        addMessage(message, 'user');
        sessionContext.push({ role: "user", content: message });
        userMessage.value = '';
        
        isTyping = true;
        const typingIndicator = showTypingIndicator();
        
        try {
            let response;
            
            if (isAskingForName) {
                // First message - get name
                userName = processName(message);
                isAskingForName = false;
                updateInputPlaceholder();
                response = `Thanks, ${userName}! It's nice to meet you. I can help you discover music concerts across America. You can search by artist, city, or date. What kind of music are you interested in?`;
                fetchConcerts(userLocation.city);
            } else {
                // Regular conversation
                const processedMessage = processUserMessage(message);
                response = await generatePersonalizedResponse(processedMessage);
            }
            
            chatBox.removeChild(typingIndicator);
            isTyping = false;
            
            addMessage(response, 'bot');
            
            // Add to context
            if (typeof response === 'string') {
                sessionContext.push({ role: "assistant", content: response });
            } else {
                sessionContext.push({ role: "assistant", content: `I found some concerts that might interest you, ${userName}.` });
            }
            
            // Keep context manageable
            if (sessionContext.length > 10) {
                sessionContext = sessionContext.slice(sessionContext.length - 10);
            }
        } catch (error) {
            console.error("Error:", error);
            
            chatBox.removeChild(typingIndicator);
            isTyping = false;
            
            const errorMsg = userName ? 
                `I'm having trouble connecting to the database right now, ${userName}. Let me show you some sample concerts instead.` :
                "I'm having trouble connecting right now. Let me show you some sample concerts instead.";
            
            addMessage(errorMsg, 'bot');
            
            setTimeout(() => {
                let location = userLocation.city === "Unknown" ? "your area" : userLocation.city;
                addMessage(useFallbackData(location), 'bot');
            }, 1000);
        }
    }

    // Process user's name
    function processName(message) {
        // Clean up greeting words
        let name = message.replace(/^(hi|hello|hey|greetings)[,.\s]*/i, '').trim();
        
        // Get first word as name
        name = name.split(' ')[0];
        
        // Capitalize first letter
        name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
        
        // Validate
        if (name.length < 2 || /[^a-zA-Z]/.test(name)) {
            name = "friend";
        }
        
        return name;
    }

    // Show typing animation
    function showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.classList.add('message', 'bot-message', 'typing-indicator');
        
        const typingContent = document.createElement('div');
        typingContent.classList.add('message-content');
        
        const dots = document.createElement('div');
        dots.classList.add('typing-dots');
        dots.innerHTML = '<span></span><span></span><span></span>';
        
        typingContent.appendChild(dots);
        typingDiv.appendChild(typingContent);
        chatBox.appendChild(typingDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
        
        return typingDiv;
    }

    // Process message to understand intent
    function processUserMessage(message) {
        const processed = {
            originalMessage: message,
            lowerMessage: message.toLowerCase(),
            intent: null,
            entities: {
                genres: [],
                locations: [],
                dates: [],
                artists: []
            }
        };
        
        // Extract genres
        const genres = ['rock', 'pop', 'classical', 'jazz', 'hip hop', 'rap', 'electronic', 'edm', 'country', 'r&b', 'metal', 'indie', 'folk'];
        genres.forEach(genre => {
            if (processed.lowerMessage.includes(genre)) {
                processed.entities.genres.push(genre);
            }
        });
        
        // Extract locations
        if (processed.lowerMessage.includes('near me')) {
            processed.entities.locations.push(userLocation.city);
        }
        
        // Check for US city names
        usCities.forEach(city => {
            if (processed.lowerMessage.includes(city.toLowerCase())) {
                processed.entities.locations.push(city);
            }
        });
        
        // Extract dates - enhanced date detection
        const dateTerms = [
            'today', 'tomorrow', 'this week', 'this weekend', 'this month', 'next week', 'next month',
            'next saturday', 'next sunday', 'next friday', 'next monday', 'next tuesday', 'next wednesday', 'next thursday',
            'in may', 'in june', 'in july', 'in august', 'in september', 'in october', 'in november', 'in december',
            'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'
        ];
        
        dateTerms.forEach(term => {
            if (processed.lowerMessage.includes(term)) {
                processed.entities.dates.push(term);
            }
        });
        
        // Check for specific date patterns
        const datePattern = /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?/i;
        const dateMatch = processed.lowerMessage.match(datePattern);
        if (dateMatch) {
            processed.entities.dates.push(dateMatch[0]);
        }
        
        // Extract artist (simple heuristic: 'by [artist]' or 'artist: [name]')
        const artistPattern = /by ([a-zA-Z0-9\s]+)/i;
        const artistMatch = message.match(artistPattern);
        if (artistMatch && artistMatch[1]) {
            processed.entities.artists.push(artistMatch[1].trim());
        }
        // Also, if message is short and not a city/genre/date, treat as possible artist
        if (processed.lowerMessage.split(' ').length <= 4 &&
            processed.entities.genres.length === 0 &&
            processed.entities.locations.length === 0 &&
            processed.entities.dates.length === 0 &&
            !/concert|event|show|performance/i.test(processed.lowerMessage)) {
            processed.entities.artists.push(message.trim());
        }
        
        // Determine intent
        if (/hello|hi|hey/i.test(processed.lowerMessage)) {
            processed.intent = 'greeting';
        } else if (processed.entities.genres.length > 0) {
            processed.intent = 'search_by_genre';
        } else if (processed.entities.artists.length > 0) {
            processed.intent = 'search_by_artist';
        } else if (processed.entities.locations.length > 0) {
            processed.intent = 'search_by_location';
        } else if (processed.entities.dates.length > 0) {
            processed.intent = 'search_by_date';
        } else if (/concert|event|show|performance/i.test(processed.lowerMessage)) {
            processed.intent = 'general_concert_inquiry';
        } else if (processed.lowerMessage.includes('thank')) {
            processed.intent = 'thank_you';
        } else if (/^[a-zA-Z\s]+$/.test(processed.lowerMessage) && processed.lowerMessage.split(' ').length <= 3) {
            processed.intent = 'possible_location_or_artist';
            processed.entities.locations.push(message);
        } else {
            processed.intent = 'unknown';
        }
        
        return processed;
    }

    // Ask personalized follow-up questions
    function askPersonalizedFollowUp(genre) {
        const questions = {
            rock: [
                `${userName}, who's your favorite rock band?`,
                `${userName}, classic or modern rock?`,
                `Been to many rock concerts, ${userName}?`
            ],
            pop: [
                `${userName}, who's your favorite pop artist?`,
                `Arena shows or intimate venues, ${userName}?`,
                `Last pop concert you attended, ${userName}?`
            ],
            classical: [
                `Favorite composer, ${userName}?`,
                `${userName}, do you play any instruments?`,
                `Ever been to the symphony, ${userName}?`
            ],
            electronic: [
                `${userName}, into house, techno, or other subgenres?`,
                `Festivals or club shows, ${userName}?`,
                `${userName}, who's your favorite DJ?`
            ],
            default: [
                `${userName}, what other music do you enjoy?`,
                `Best concert you've ever been to, ${userName}?`,
                `${userName}, outdoor or indoor venues?`
            ]
        };
        
        // Choose a random question
        const options = questions[genre.toLowerCase()] || questions.default;
        return options[Math.floor(Math.random() * options.length)];
    }

    // Generate personalized responses
    async function generatePersonalizedResponse(processedMessage) {
        try {
            let response;
            switch (processedMessage.intent) {
                case 'greeting':
                    response = `Hi again, ${userName}! You can search for concerts by artist, city, or date. How can I help you today?`;
                    break;
                case 'search_by_genre':
                    const genre = processedMessage.entities.genres[0];
                    let location = userLocation.city;
                    if (processedMessage.entities.locations.length > 0 && 
                        processedMessage.entities.locations[0] !== userLocation.city) {
                        location = processedMessage.entities.locations[0];
                    }
                    const results = await fetchConcertsByGenre(genre, location);
                    setTimeout(() => {
                        if (userName) {
                            const question = askPersonalizedFollowUp(genre);
                            addMessage(question, 'bot');
                            sessionContext.push({ role: "assistant", content: question });
                        }
                    }, 3000);
                    return results;
                case 'search_by_artist':
                    const artist = processedMessage.entities.artists[0];
                    if (artist) {
                        response = await fetchConcertsByArtist(artist, userLocation.city);
                    } else {
                        response = `Please specify an artist name to search for concerts, ${userName}.`;
                    }
                    break;
                case 'search_by_location':
                    response = await fetchConcerts(processedMessage.entities.locations[0]);
                    break;
                case 'search_by_date':
                    const dateQuery = processedMessage.entities.dates[0];
                    if (dateQuery) {
                        response = `I'll search for concerts ${dateQuery}. Let me check what's available...`;
                        if (window.location.hostname.includes('github.io')) {
                            setTimeout(() => {
                                addMessage(useFallbackDataByDate(dateQuery, userLocation.city), 'bot');
                            }, 1000);
                        } else {
                            await fetchConcertsByDate(userLocation.city, dateQuery);
                        }
                    } else {
                        response = `${userName}, I can help you find concerts by date. Try asking about specific dates like "next Saturday" or "in May".`;
                    }
                    break;
                case 'general_concert_inquiry':
                    response = `${userName}, I can help you find concerts! You can search by artist, city, or date.`;
                    break;
                case 'thank_you':
                    response = `You're welcome, ${userName}! Anything else you'd like to know?`;
                    break;
                case 'possible_location_or_artist':
                    response = await fetchConcerts(processedMessage.entities.locations[0]);
                    break;
                default:
                    response = `I'm not sure what you're asking, ${userName}. Try asking about concerts by artist, city, or date.`;
            }
            return response;
        } catch (error) {
            console.error("Error generating response:", error);
            return `I'm having trouble processing your request, ${userName}. Could you please try again?`;
        }
    }

    // Fetch concerts
    async function fetchConcerts(location, page = 0) {
        // If we're on GitHub Pages, always use fallback data
        if (isGitHubPages) {
            return useFallbackData(location);
        }
        
        try {
            // Check cache first
            const cacheKey = `concerts_${location.toLowerCase()}`;
            if (concertCache[cacheKey]) {
                return generateConcertList(concertCache[cacheKey], `Concerts in ${location}`);
            }
            
            console.log(`Fetching concerts for ${location}...`);
            
            const url = `https://app.ticketmaster.com/discovery/v2/events.json?classificationName=music&city=${encodeURIComponent(location)}&apikey=${ticketmasterApiKey}&size=10`;
            const response = await fetchWithRetry(url);
            
            if (!response.ok) {
                console.error(`API error: ${response.status}`);
                return useFallbackData(location);
            }
            
            const data = await response.json();
            
            if (!data._embedded?.events?.length) {
                console.log(`No concerts found for ${location}`);
                return useFallbackData(location);
            }
            
            // Format concerts
            const concerts = data._embedded.events.map(event => ({
                name: event.name,
                date: event.dates.start.localDate,
                time: event.dates.start.localTime || 'TBA',
                venue: event._embedded?.venues?.[0]?.name || 'Venue TBA',
                location: `${event._embedded?.venues?.[0]?.city?.name || ''}, ${event._embedded?.venues?.[0]?.state?.stateCode || ''}`,
                image: event.images?.[0]?.url,
                url: event.url,
                genre: event.classifications?.[0]?.genre?.name || 'Various'
            }));
            
            concertCache[cacheKey] = concerts;
            return generateConcertList(concerts, `Concerts in ${location}`);
        } catch (error) {
            console.error("Concert fetch error:", error);
            return useFallbackData(location);
        }
    }

    // Fetch concerts by genre
    async function fetchConcertsByGenre(genre, location) {
        // If we're on GitHub Pages, use fallback data
        if (isGitHubPages) {
            return useFallbackDataByGenre(genre, location);
        }
        
        try {
            const cacheKey = `concerts_${genre}_${location.toLowerCase()}`;
            if (concertCache[cacheKey]) {
                return generateConcertList(concertCache[cacheKey], `${genre.charAt(0).toUpperCase() + genre.slice(1)} concerts in ${location}`);
            }
            
            // Try with genre ID first
            const genreId = getGenreId(genre);
            let url = `https://app.ticketmaster.com/discovery/v2/events.json?classificationName=music&city=${encodeURIComponent(location)}&apikey=${ticketmasterApiKey}&size=10`;
            
            if (genreId) {
                url += `&genreId=${genreId}`;
            } else {
                url += `&keyword=${encodeURIComponent(genre)}`;
            }
            
            const response = await fetchWithRetry(url);
            
            if (!response.ok) {
                return useFallbackDataByGenre(genre, location);
            }
            
            const data = await response.json();
            
            // If no results, try broader search
            if (!data._embedded?.events?.length) {
                const fallbackUrl = `https://app.ticketmaster.com/discovery/v2/events.json?classificationName=music&city=${encodeURIComponent(location)}&keyword=${encodeURIComponent(genre)}&apikey=${ticketmasterApiKey}&size=10`;
                const fallbackResponse = await fetchWithRetry(fallbackUrl);
                
                if (!fallbackResponse.ok) {
                    return useFallbackDataByGenre(genre, location);
                }
                
                const fallbackData = await fallbackResponse.json();
                
                if (!fallbackData._embedded?.events?.length) {
                    return useFallbackDataByGenre(genre, location);
                }
                
                const concerts = fallbackData._embedded.events.map(formatConcert);
                concertCache[cacheKey] = concerts;
                return generateConcertList(concerts, `${genre.charAt(0).toUpperCase() + genre.slice(1)}-related concerts in ${location}`);
            }
            
            const concerts = data._embedded.events.map(formatConcert);
            concertCache[cacheKey] = concerts;
            return generateConcertList(concerts, `${genre.charAt(0).toUpperCase() + genre.slice(1)} concerts in ${location}`);
        } catch (error) {
            console.error("Genre search error:", error);
            return useFallbackDataByGenre(genre, location);
        }
    }

    // Helper to format concert data
    function formatConcert(event) {
        return {
            name: event.name,
            date: event.dates.start.localDate,
            time: event.dates.start.localTime || 'TBA',
            venue: event._embedded?.venues?.[0]?.name || 'Venue TBA',
            location: `${event._embedded?.venues?.[0]?.city?.name || ''}, ${event._embedded?.venues?.[0]?.state?.stateCode || ''}`,
            image: event.images?.[0]?.url,
            url: event.url,
            genre: event.classifications?.[0]?.genre?.name || 'Various'
        };
    }

    // Fetch concerts by date
    async function fetchConcertsByDate(dateRange, location) {
        // If we're on GitHub Pages, use fallback data
        if (isGitHubPages) {
            return useFallbackDataByDate(dateRange, location);
        }
        
        try {
            const { startDate, endDate } = getDateRange(dateRange);
            
            const cacheKey = `concerts_${dateRange}_${location.toLowerCase()}`;
            if (concertCache[cacheKey]) {
                return generateConcertList(concertCache[cacheKey], `Concerts in ${location} (${dateRange})`);
            }
            
            const url = `https://app.ticketmaster.com/discovery/v2/events.json?classificationName=music&city=${encodeURIComponent(location)}&startDateTime=${startDate}&endDateTime=${endDate}&apikey=${ticketmasterApiKey}&size=10`;
            const response = await fetchWithRetry(url);
            
            if (!response.ok) {
                return useFallbackDataByDate(dateRange, location);
            }
            
            const data = await response.json();
            
            if (!data._embedded?.events?.length) {
                return useFallbackDataByDate(dateRange, location);
            }
            
            const concerts = data._embedded.events.map(formatConcert);
            concertCache[cacheKey] = concerts;
            return generateConcertList(concerts, `Concerts in ${location} (${dateRange})`);
        } catch (error) {
            console.error("Date search error:", error);
            return useFallbackDataByDate(dateRange, location);
        }
    }

    // Helper function to get date range based on text
    function getDateRange(dateText) {
        const today = new Date();
        let startDate = new Date(today);
        let endDate = new Date(today);
        
        // Format: YYYY-MM-DDTHH:MM:SSZ
        const formatDate = (date) => {
            return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
        };
        
        switch (dateText.toLowerCase()) {
            case 'today':
                // Already set correctly
                endDate.setHours(23, 59, 59);
                break;
            case 'tomorrow':
                startDate.setDate(today.getDate() + 1);
                endDate.setDate(today.getDate() + 1);
                endDate.setHours(23, 59, 59);
                break;
            case 'this week':
                // Start from today, end this Sunday
                const daysUntilSunday = 7 - today.getDay();
                endDate.setDate(today.getDate() + daysUntilSunday);
                endDate.setHours(23, 59, 59);
                break;
            case 'this weekend':
                // Friday to Sunday
                const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
                const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 6; // If it's Sunday, we want next Friday
                startDate.setDate(today.getDate() + daysUntilFriday);
                endDate.setDate(startDate.getDate() + 2); // Friday + 2 = Sunday
                endDate.setHours(23, 59, 59);
                break;
            case 'this month':
                // End of current month
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
                break;
            case 'next week':
                // Start next Monday, end next Sunday
                const daysUntilNextMonday = (7 - today.getDay()) % 7 + 1;
                startDate.setDate(today.getDate() + daysUntilNextMonday);
                endDate.setDate(startDate.getDate() + 6);
                endDate.setHours(23, 59, 59);
                break;
            case 'next month':
                // Start 1st of next month, end last day of next month
                startDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0, 23, 59, 59);
                break;
            default:
                // Default to next 30 days
                endDate.setDate(today.getDate() + 30);
                endDate.setHours(23, 59, 59);
        }
        
        return {
            startDate: formatDate(startDate),
            endDate: formatDate(endDate)
        };
    }

    // Helper function to map genre text to Ticketmaster genre IDs
    function getGenreId(genre) {
        const genreMap = {
            'rock': 'KnvZfZ7vAeA',
            'pop': 'KnvZfZ7vAev',
            'classical': 'KnvZfZ7v7nJ',
            'jazz': 'KnvZfZ7vAvE',
            'hip hop': 'KnvZfZ7vAv1',
            'rap': 'KnvZfZ7vAv1',
            'electronic': 'KnvZfZ7vAvF',
            'edm': 'KnvZfZ7vAvF',
            'country': 'KnvZfZ7vAv6',
            'r&b': 'KnvZfZ7vAee',
            'metal': 'KnvZfZ7vAvt',
            'indie': 'KnvZfZ7vAed',
            'folk': 'KnvZfZ7vAeF'
        };
        
        return genreMap[genre.toLowerCase()] || '';
    }

    // Add message to chat
    function addMessage(message, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);
        
        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');
        
        // Handle if message is an HTML element (for concert listings)
        if (typeof message === 'object') {
            messageContent.appendChild(message);
        } else {
            messageContent.textContent = message;
        }
        
        messageDiv.appendChild(messageContent);
        chatBox.appendChild(messageDiv);
        
        // Scroll to bottom
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Generate formatted concert listings
    function generateConcertList(concerts, title) {
        const concertListElement = document.createElement('div');
        concertListElement.classList.add('concert-list');
        
        // Personalize the title with user name if available
        const personalizedTitle = userName ? 
            title.replace(/(Concerts|concerts)/, `${userName}'s $1`) : 
            title;
        
        const heading = document.createElement('h3');
        heading.textContent = personalizedTitle;
        concertListElement.appendChild(heading);
        
        if (concerts.length === 0) {
            const noResults = document.createElement('p');
            noResults.textContent = userName ? 
                `Sorry ${userName}, no concerts found matching your criteria.` : 
                "No concerts found matching your criteria.";
            concertListElement.appendChild(noResults);
            return concertListElement;
        }
        
        const concertGrid = document.createElement('div');
        concertGrid.classList.add('concert-grid');
        
        concerts.forEach(concert => {
            const concertCard = document.createElement('div');
            concertCard.classList.add('concert-card');
            
            // If there's an image, add it
            if (concert.image) {
                const imageContainer = document.createElement('div');
                imageContainer.classList.add('concert-image');
                
                const image = document.createElement('img');
                image.src = concert.image;
                image.alt = concert.name;
                
                imageContainer.appendChild(image);
                concertCard.appendChild(imageContainer);
            }
            
            const concertInfo = document.createElement('div');
            concertInfo.classList.add('concert-info');
            
            const concertName = document.createElement('h4');
            concertName.textContent = concert.name;
            concertInfo.appendChild(concertName);
            
            const concertDate = document.createElement('p');
            concertDate.classList.add('concert-date');
            concertDate.textContent = `${formatDate(concert.date)}${concert.time !== 'TBA' ? ' at ' + formatTime(concert.time) : ''}`;
            concertInfo.appendChild(concertDate);
            
            const concertVenue = document.createElement('p');
            concertVenue.classList.add('concert-venue');
            concertVenue.textContent = `${concert.venue}, ${concert.location}`;
            concertInfo.appendChild(concertVenue);
            
            const concertGenre = document.createElement('p');
            concertGenre.classList.add('concert-genre');
            concertGenre.textContent = `Genre: ${concert.genre}`;
            concertInfo.appendChild(concertGenre);
            
            if (concert.url) {
                const ticketLink = document.createElement('a');
                ticketLink.href = concert.url;
                ticketLink.target = '_blank';
                ticketLink.classList.add('ticket-button');
                ticketLink.textContent = 'View Details';
                concertInfo.appendChild(ticketLink);
            }
            const saveButton = document.createElement('button');
saveButton.classList.add('save-to-calendar-btn');

// Create button content with icon
saveButton.innerHTML = `
    <i class="fas fa-calendar-plus"></i>
    <span>Save to Calendar</span>
`;

// Style the button
saveButton.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 16px;
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    color: white;
    border: none;
    border-radius: 8px;
    font-family: 'Poppins', sans-serif;
    font-weight: 500;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    margin-top: 10px;
`;

// Hover effects
saveButton.addEventListener('mouseenter', () => {
    saveButton.style.background = 'linear-gradient(135deg, #4338ca, #6d28d9)';
    saveButton.style.transform = 'translateY(-2px)';
    saveButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
});

saveButton.addEventListener('mouseleave', () => {
    saveButton.style.background = 'linear-gradient(135deg, #4f46e5, #7c3aed)';
    saveButton.style.transform = 'translateY(0)';
    saveButton.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.1)';
});

// Active/click effect
saveButton.addEventListener('mousedown', () => {
    saveButton.style.transform = 'translateY(1px)';
});

saveButton.addEventListener('mouseup', () => {
    saveButton.style.transform = 'translateY(-2px)';
});

// Click handler
saveButton.addEventListener('click', (e) => {
    e.preventDefault();
    const event = {
        title: concert.name,
        date: concert.date,
        location: concert.venue + ', ' + concert.location
    };
    let events = JSON.parse(localStorage.getItem('concertEvents')) || [];
    events.push(event);
    localStorage.setItem('concertEvents', JSON.stringify(events));
    
    // Create a more stylish notification
    const notification = document.createElement('div');
    notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>Saved to calendar!</span>
    `;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: 'Poppins', sans-serif;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.5s ease-out';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 500);
    }, 3000);
    
    // Add keyframes to head if not already present
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
});

concertInfo.appendChild(saveButton);
            
            concertCard.appendChild(concertInfo);
            concertGrid.appendChild(concertCard);
        });
        
        concertListElement.appendChild(concertGrid);
        
        // Add personalized recommendation if we have the user's name
        if (userName && userName !== "friend") {
            const personalNote = document.createElement('p');
            personalNote.classList.add('personal-note');
            personalNote.textContent = `Based on your interests, ${userName}, I think you'll especially enjoy these shows!`;
            concertListElement.appendChild(personalNote);
        }
        
        return concertListElement;
    }

    // Helper function to format date
    function formatDate(dateString) {
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    }

    // Helper function to format time
    function formatTime(timeString) {
        if (!timeString) return '';
        
        const [hours, minutes] = timeString.split(':');
        let hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        
        hour = hour % 12;
        hour = hour ? hour : 12; // Convert 0 to 12
        
        return `${hour}:${minutes} ${ampm}`;
    }

    // Fallback data when API is unavailable
    function useFallbackData(location) {
        // Sample concert data as fallback
        const fallbackConcerts = [
            {
                name: "Coldplay Virtual Experience",
                date: "2023-12-15",
                time: "19:30:00",
                venue: "Madison Square Garden",
                location: `${location}, USA`,
                image: "https://i.scdn.co/image/ab6761610000e5eb989ed05e1f0570cc4726c2d3",
                url: "#",
                genre: "Pop/Rock"
            },
            {
                name: "Taylor Swift - Eras Tour",
                date: "2023-12-20",
                time: "20:00:00",
                venue: "SoFi Stadium",
                location: `${location}, USA`,
                image: "https://i.scdn.co/image/ab6761610000e5eb5a00969a4698c3132a15fbb0",
                url: "#",
                genre: "Pop"
            },
            {
                name: "EDM Winter Festival",
                date: "2023-12-25",
                time: "21:00:00",
                venue: "Barclays Center",
                location: `${location}, USA`,
                image: "https://images.unsplash.com/photo-1574137909569-6a7101cc701d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8NXx8ZWRtJTIwY29uY2VydHxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=500&q=60",
                url: "#",
                genre: "Electronic"
            },
            {
                name: "Classical Symphony Night",
                date: "2023-12-18",
                time: "18:30:00",
                venue: "Carnegie Hall",
                location: `${location}, USA`,
                image: "https://images.unsplash.com/photo-1514846160150-2cfb150a9c6b?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8Mnx8Y2xhc3NpY2FsJTIwY29uY2VydHxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=500&q=60",
                url: "#",
                genre: "Classical"
            }
        ];
        
        return generateConcertList(fallbackConcerts, `Sample Concerts in ${location}, USA (API Unavailable)`);
    }

    // Fallback data by genre when API is unavailable
    function useFallbackDataByGenre(genre, location) {
        // Create genre-specific fallback data
        const fallbackConcerts = [];
        
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        const nextMonth = new Date();
        nextMonth.setMonth(today.getMonth() + 1);
        
        const formatLocalDate = (date) => {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        };

        // Map of US venues by genre
        const venuesByGenre = {
            rock: ["Madison Square Garden", "The Forum", "Red Rocks Amphitheatre"],
            pop: ["SoFi Stadium", "MetLife Stadium", "T-Mobile Arena"],
            classical: ["Carnegie Hall", "Walt Disney Concert Hall", "Symphony Center"],
            jazz: ["Blue Note Jazz Club", "Village Vanguard", "Preservation Hall"],
            electronic: ["Echostage", "Webster Hall", "Stereo Live"],
            country: ["Grand Ole Opry", "The Ryman Auditorium", "Billy Bob's Texas"]
        };
        
        // Get venues for this genre, or default to general venues
        const venues = venuesByGenre[genre.toLowerCase()] || 
                      ["Madison Square Garden", "The Fillmore", "House of Blues"];
        
        // Add genre-specific concerts
        switch(genre.toLowerCase()) {
            case 'rock':
                fallbackConcerts.push({
                    name: "Coldplay World Tour",
                    date: formatLocalDate(nextWeek),
                    time: "19:30:00",
                    venue: venues[0],
                    location: `${location}, USA`,
                    image: "https://i.scdn.co/image/ab6761610000e5eb989ed05e1f0570cc4726c2d3",
                    url: "#",
                    genre: "Rock"
                }, {
                    name: "Foo Fighters Live",
                    date: formatLocalDate(nextMonth),
                    time: "20:00:00",
                    venue: venues[1],
                    location: `${location}, USA`,
                    image: "https://i.scdn.co/image/ab6761610000e5eb9a42185a6e2297e7c7f87ef3",
                    url: "#",
                    genre: "Rock"
                });
                break;
                
            case 'pop':
                fallbackConcerts.push({
                    name: "Taylor Swift - Eras Tour",
                    date: formatLocalDate(nextWeek),
                    time: "20:00:00",
                    venue: venues[0],
                    location: `${location}, USA`,
                    image: "https://i.scdn.co/image/ab6761610000e5eb5a00969a4698c3132a15fbb0",
                    url: "#",
                    genre: "Pop"
                }, {
                    name: "Ariana Grande Concert",
                    date: formatLocalDate(nextMonth),
                    time: "19:00:00",
                    venue: venues[1],
                    location: `${location}, USA`,
                    image: "https://i.scdn.co/image/ab6761610000e5ebcdce7620dc940db079bf4952",
                    url: "#",
                    genre: "Pop"
                });
                break;
                
            case 'electronic':
            case 'edm':
                fallbackConcerts.push({
                    name: "EDM Winter Festival",
                    date: formatLocalDate(nextWeek),
                    time: "22:00:00",
                    venue: venues[0],
                    location: `${location}, USA`,
                    image: "https://images.unsplash.com/photo-1574137909569-6a7101cc701d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8NXx8ZWRtJTIwY29uY2VydHxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=500&q=60",
                    url: "#",
                    genre: "Electronic"
                }, {
                    name: "Techno Night with Famous DJs",
                    date: formatLocalDate(nextMonth),
                    time: "23:00:00",
                    venue: venues[1],
                    location: `${location}, USA`,
                    image: "https://images.unsplash.com/photo-1642078078166-5242179de5d8?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8M3x8ZGp8ZW58MHx8MHx8&auto=format&fit=crop&w=500&q=60",
                    url: "#",
                    genre: "Electronic"
                });
                break;
                
            case 'classical':
                fallbackConcerts.push({
                    name: "Symphony Orchestra Performance",
                    date: formatLocalDate(nextWeek),
                    time: "18:30:00",
                    venue: venues[0],
                    location: `${location}, USA`,
                    image: "https://images.unsplash.com/photo-1514846160150-2cfb150a9c6b?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8Mnx8Y2xhc3NpY2FsJTIwY29uY2VydHxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=500&q=60",
                    url: "#",
                    genre: "Classical"
                }, {
                    name: "Piano Concerto Evening",
                    date: formatLocalDate(nextMonth),
                    time: "19:00:00",
                    venue: venues[1],
                    location: `${location}, USA`,
                    image: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8NXx8cGlhbm98ZW58MHx8MHx8&auto=format&fit=crop&w=500&q=60",
                    url: "#",
                    genre: "Classical"
                });
                break;
            
            case 'country':
                fallbackConcerts.push({
                    name: "Country Music Festival",
                    date: formatLocalDate(nextWeek),
                    time: "18:00:00",
                    venue: venues[0],
                    location: `${location}, USA`,
                    image: "https://images.unsplash.com/photo-1506157786151-b8491531f063?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8Mnx8Y291bnRyeSUyMG11c2ljfGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=500&q=60",
                    url: "#",
                    genre: "Country"
                }, {
                    name: "Nashville Night",
                    date: formatLocalDate(nextMonth),
                    time: "19:00:00",
                    venue: venues[1],
                    location: `${location}, USA`,
                    image: "https://images.unsplash.com/photo-1604848698030-c434ba08ece1?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8M3x8Y291bnRyeSUyMG11c2ljfGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=500&q=60",
                    url: "#",
                    genre: "Country"
                });
                break;
            
            default:
                // Generic concerts for any other genre
                fallbackConcerts.push({
                    name: `${genre.charAt(0).toUpperCase() + genre.slice(1)} Music Festival`,
                    date: formatLocalDate(nextWeek),
                    time: "18:00:00",
                    venue: "American Music Hall",
                    location: `${location}, USA`,
                    image: "https://images.unsplash.com/photo-1574137909569-6a7101cc701d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8NXx8Y29uY2VydHxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=500&q=60",
                    url: "#",
                    genre: genre.charAt(0).toUpperCase() + genre.slice(1)
                }, {
                    name: `Best of ${genre.charAt(0).toUpperCase() + genre.slice(1)}`,
                    date: formatLocalDate(nextMonth),
                    time: "19:00:00",
                    venue: "The Fillmore",
                    location: `${location}, USA`,
                    image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8M3x8Y29uY2VydHxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=500&q=60",
                    url: "#",
                    genre: genre.charAt(0).toUpperCase() + genre.slice(1)
                });
        }
        
        return generateConcertList(fallbackConcerts, `${genre.charAt(0).toUpperCase() + genre.slice(1)} concerts in ${location}, USA (Sample Data)`);
    }

    // Fallback data by date when API is unavailable
    function useFallbackDataByDate(dateRange, location) {
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        const nextMonth = new Date();
        nextMonth.setMonth(today.getMonth() + 1);
        
        const formatLocalDate = (date) => {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        };
        
        // Determine which date to use based on the requested range
        let concertDate = today;
        if (dateRange.includes('next week') || dateRange.includes('weekend')) {
            concertDate = nextWeek;
        } else if (dateRange.includes('next month')) {
            concertDate = nextMonth;
        }
        
        // Array of popular US venues
        const popularVenues = [
            "Madison Square Garden", 
            "Hollywood Bowl",
            "Red Rocks Amphitheatre",
            "Radio City Music Hall",
            "The Fillmore"
        ];
        
        // Create date-based fallback data with US venues
        const fallbackConcerts = [
            {
                name: "Mixed Genre Music Festival",
                date: formatLocalDate(concertDate),
                time: "17:00:00",
                venue: popularVenues[0],
                location: `${location}, USA`,
                image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8M3x8Y29uY2VydHxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=500&q=60",
                url: "#",
                genre: "Various"
            },
            {
                name: "Rock Night Live",
                date: formatLocalDate(concertDate),
                time: "19:30:00",
                venue: popularVenues[1],
                location: `${location}, USA`,
                image: "https://images.unsplash.com/photo-1557787163-1635e2efb160?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8NHx8cm9jayUyMGNvbmNlcnR8ZW58MHx8MHx8&auto=format&fit=crop&w=500&q=60",
                url: "#",
                genre: "Rock"
            },
            {
                name: "Classical Evening",
                date: formatLocalDate(concertDate),
                time: "18:00:00",
                venue: popularVenues[2],
                location: `${location}, USA`,
                image: "https://images.unsplash.com/photo-1514846160150-2cfb150a9c6b?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8Mnx8Y2xhc3NpY2FsJTIwY29uY2VydHxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=500&q=60",
                url: "#",
                genre: "Classical"
            },
            {
                name: "Pop Stars Live",
                date: formatLocalDate(concertDate),
                time: "20:00:00",
                venue: popularVenues[3],
                location: `${location}, USA`,
                image: "https://images.unsplash.com/photo-1585023923179-dcd5c5ad13f9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8NXx8cG9wJTIwc2luZ2VyfGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=500&q=60",
                url: "#",
                genre: "Pop"
            }
        ];
        
        return generateConcertList(fallbackConcerts, `Concerts in ${location}, USA for ${dateRange} (Sample Data)`);
    }

    // Fetch concerts by artist (using Ticketmaster API keyword search)
    async function fetchConcertsByArtist(artist, location) {
        if (isGitHubPages) {
            // Use fallback data by genre as a proxy for artist
            return useFallbackDataByGenre('pop', location);
        }
        try {
            const cacheKey = `concerts_artist_${artist}_${location.toLowerCase()}`;
            if (concertCache[cacheKey]) {
                return generateConcertList(concertCache[cacheKey], `Concerts for ${artist} in ${location}`);
            }
            const url = `https://app.ticketmaster.com/discovery/v2/events.json?classificationName=music&city=${encodeURIComponent(location)}&keyword=${encodeURIComponent(artist)}&apikey=${ticketmasterApiKey}&size=10`;
            const response = await fetchWithRetry(url);
            if (!response.ok) {
                return useFallbackDataByGenre('pop', location);
            }
            const data = await response.json();
            if (!data._embedded?.events?.length) {
                return useFallbackDataByGenre('pop', location);
            }
            const concerts = data._embedded.events.map(formatConcert);
            concertCache[cacheKey] = concerts;
            return generateConcertList(concerts, `Concerts for ${artist} in ${location}`);
        } catch (error) {
            console.error("Artist search error:", error);
            return useFallbackDataByGenre('pop', location);
        }
    }

    const API_BASE_URL = window.location.hostname.includes('github.io') 
      ? 'https://your-heroku-app-name.herokuapp.com' 
      : 'http://localhost:3000';
}); 