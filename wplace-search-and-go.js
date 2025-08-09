// ==UserScript==
// @name         WPlace Location Search
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Adds integrated search functionality to wplace.live right-side menu
// @author       You
// @icon         https://wplace.live/favicon.ico
// @match        https://wplace.live/*
// @match        http://wplace.live/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      nominatim.openstreetmap.org
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Wait for the right-side menu to load
    function waitForMenu() {
        return new Promise((resolve) => {
            const checkMenu = setInterval(() => {
                const menu = document.querySelector('.z-30.top-2.right-2.absolute > .items-center.gap-4.flex-col.flex');
                if (menu) {
                    clearInterval(checkMenu);
                    resolve(menu);
                }
            }, 100);
        });
    }

    // Create search button and interface
    function createSearchInterface(menuContainer) {
        // Create search button container
        const searchButtonContainer = document.createElement('div');
        searchButtonContainer.id = 'wplace-search-button-container';
        searchButtonContainer.style.position = 'relative';
        
        // Create round search button matching site style
        const searchButton = document.createElement('button');
        searchButton.id = 'wplace-search-toggle';
        searchButton.className = 'wplace-menu-button';
        searchButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
            </svg>
        `;
        
        // Create expandable search box
        const searchBox = document.createElement('div');
        searchBox.id = 'wplace-search-box';
        searchBox.className = 'wplace-search-collapsed';
        searchBox.innerHTML = `
            <input type="text" id="wplace-search-input" placeholder="search for a place ..." />
            <button id="wplace-clear-btn" style="display: none;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        
        // Create results container
        const resultsContainer = document.createElement('div');
        resultsContainer.id = 'wplace-search-results';
        resultsContainer.style.display = 'none';
        
        searchButtonContainer.appendChild(searchButton);
        searchButtonContainer.appendChild(searchBox);
        searchButtonContainer.appendChild(resultsContainer);
        
        // Add to the bottom of the menu
        menuContainer.appendChild(searchButtonContainer);
    }

    // Add styles
    function addStyles() {
        GM_addStyle(`
            #wplace-search-button-container {
                position: relative;
            }

            .wplace-menu-button {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: rgb(243, 244, 246);
                border: none;
                box-shadow: rgba(0, 0, 0, 0.1) 0px 1px 3px 0px, rgba(0, 0, 0, 0.06) 0px 1px 2px 0px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                color: rgb(107, 114, 128);
                transition: all 0.2s;
            }

            .wplace-menu-button:hover {
                box-shadow: rgba(0, 0, 0, 0.15) 0px 2px 4px 0px, rgba(0, 0, 0, 0.1) 0px 2px 3px 0px;
                transform: scale(1.05);
            }

            #wplace-search-box {
                position: absolute;
                right: 0;
                top: 0;
                height: 40px;
                background: white;
                border-radius: 20px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                transition: all 0.3s ease-out;
                overflow: hidden;
                z-index: 10;
            }

            .wplace-search-collapsed {
                width: 40px;
                opacity: 0;
                pointer-events: none;
            }

            .wplace-search-expanded {
                width: 300px;
                opacity: 1;
                pointer-events: all;
            }

            #wplace-search-input {
                flex: 1;
                border: none;
                padding: 0 20px;
                height: 100%;
                font-size: 14px;
                background: transparent;
                outline: none;
                font-family: system-ui, -apple-system, sans-serif;
            }

            #wplace-clear-btn {
                background: none;
                border: none;
                padding: 0 16px;
                cursor: pointer;
                color: #5f6368;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: opacity 0.2s;
            }

            #wplace-clear-btn:hover {
                opacity: 0.7;
            }

            #wplace-search-results {
                position: absolute;
                right: 0;
                top: 48px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 2px 12px rgba(0,0,0,0.2);
                max-height: 400px;
                overflow-y: auto;
                width: 300px;
                z-index: 9;
            }

            .wplace-search-result {
                padding: 12px 16px;
                cursor: pointer;
                border-bottom: 1px solid #e8eaed;
                transition: background-color 0.2s;
            }

            .wplace-search-result:hover {
                background-color: #f8f9fa;
            }

            .wplace-search-result:first-child {
                border-radius: 12px 12px 0 0;
            }

            .wplace-search-result:last-child {
                border-bottom: none;
                border-radius: 0 0 12px 12px;
            }

            .wplace-result-name {
                font-size: 14px;
                color: #202124;
                margin-bottom: 4px;
                font-weight: 500;
                font-family: system-ui, -apple-system, sans-serif;
            }

            .wplace-result-address {
                font-size: 12px;
                color: #5f6368;
                font-family: system-ui, -apple-system, sans-serif;
            }

            .wplace-loading {
                padding: 20px;
                text-align: center;
                color: #5f6368;
                font-size: 14px;
                font-family: system-ui, -apple-system, sans-serif;
            }

            .wplace-no-results {
                padding: 20px;
                text-align: center;
                color: #5f6368;
                font-size: 14px;
                font-family: system-ui, -apple-system, sans-serif;
            }

            @media (max-width: 480px) {
                .wplace-search-expanded {
                    width: 250px;
                }
                
                #wplace-search-results {
                    width: 250px;
                }
            }
        `);
    }

    // Search for locations using OpenStreetMap Nominatim API (free, no API key required)
    function searchLocation(query) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
                headers: {
                    'User-Agent': 'WPlace-Search-UserScript/1.0'
                },
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        resolve(data);
                    } catch (error) {
                        reject(error);
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // Navigate to location on wplace
    function navigateToLocation(lat, lon) {
        // Default zoom level (can be adjusted)
        const zoom = 14.62;
        const url = `https://wplace.live/?lat=${lat}&lng=${lon}&zoom=${zoom}`;
        window.location.href = url;
    }

    // Display search results
    function displayResults(results) {
        const resultsContainer = document.getElementById('wplace-search-results');
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="wplace-no-results">No results found</div>';
            resultsContainer.style.display = 'block';
            return;
        }

        resultsContainer.innerHTML = '';
        results.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = 'wplace-search-result';
            
            // Format display name
            const displayName = result.display_name || 'Unknown location';
            const nameParts = displayName.split(',');
            const primaryName = nameParts[0];
            const address = nameParts.slice(1).join(',').trim();
            
            resultItem.innerHTML = `
                <div class="wplace-result-name">${primaryName}</div>
                ${address ? `<div class="wplace-result-address">${address}</div>` : ''}
            `;
            
            resultItem.addEventListener('click', () => {
                navigateToLocation(result.lat, result.lon);
                // Close search after navigation
                const searchBox = document.getElementById('wplace-search-box');
                const searchInput = document.getElementById('wplace-search-input');
                searchBox.className = 'wplace-search-collapsed';
                searchInput.value = '';
                resultsContainer.style.display = 'none';
            });
            
            resultsContainer.appendChild(resultItem);
        });
        
        resultsContainer.style.display = 'block';
    }

    // Handle search
    async function handleSearch() {
        const searchInput = document.getElementById('wplace-search-input');
        const query = searchInput.value.trim();
        
        if (!query) return;
        
        const resultsContainer = document.getElementById('wplace-search-results');
        resultsContainer.innerHTML = '<div class="wplace-loading">Searching...</div>';
        resultsContainer.style.display = 'block';
        
        try {
            const results = await searchLocation(query);
            displayResults(results);
        } catch (error) {
            console.error('Search error:', error);
            resultsContainer.innerHTML = '<div class="wplace-no-results">Error searching. Please try again.</div>';
        }
    }

    // Initialize the search functionality
    async function init() {
        const menuContainer = await waitForMenu();
        
        createSearchInterface(menuContainer);
        addStyles();
        
        const searchButton = document.getElementById('wplace-search-toggle');
        const searchBox = document.getElementById('wplace-search-box');
        const searchInput = document.getElementById('wplace-search-input');
        const clearBtn = document.getElementById('wplace-clear-btn');
        const resultsContainer = document.getElementById('wplace-search-results');
        
        let isSearchOpen = false;
        
        // Toggle search box on button click
        searchButton.addEventListener('click', (e) => {
            e.stopPropagation();
            isSearchOpen = !isSearchOpen;
            
            if (isSearchOpen) {
                searchBox.className = 'wplace-search-expanded';
                setTimeout(() => searchInput.focus(), 300);
            } else {
                searchBox.className = 'wplace-search-collapsed';
                resultsContainer.style.display = 'none';
            }
        });
        
        // Prevent search box clicks from closing it
        searchBox.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Show/hide clear button based on input
        searchInput.addEventListener('input', () => {
            clearBtn.style.display = searchInput.value ? 'block' : 'none';
        });
        
        // Clear input and results
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.style.display = 'none';
            resultsContainer.style.display = 'none';
            searchInput.focus();
        });
        
        // Handle Enter key in search input
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });
        
        // Handle Escape key to close search
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchBox.className = 'wplace-search-collapsed';
                resultsContainer.style.display = 'none';
                isSearchOpen = false;
            }
        });
        
        // Hide search and results when clicking outside
        document.addEventListener('click', (e) => {
            const buttonContainer = document.getElementById('wplace-search-button-container');
            if (!buttonContainer.contains(e.target)) {
                searchBox.className = 'wplace-search-collapsed';
                resultsContainer.style.display = 'none';
                isSearchOpen = false;
            }
        });
    }

    // Start the script
    init();
})();