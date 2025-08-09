// ==UserScript==
// @name         HFviewer
// @namespace    https://github.com/lunnicingus/HF-viewer
// @version      1.1
// @description  Better porn browse - based off the original EMPViewer
// @author       lunnicingus
// @match        https://www.happyfappy.org/torrents.php*
// @match        https://www.happyfappy.org/top10.php*
// @match        https://www.happyfappy.org/collages.php*
// @require      https://cdnjs.cloudflare.com/ajax/libs/preact/10.16.0/preact.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/htm/3.1.1/htm.js
// @updateURL    https://github.com/lunnicingus/HF-viewer/raw/main/HFviewer.user.js
// @downloadURL  https://github.com/lunnicingus/HF-viewer/raw/main/HFviewer.user.js
// @grant        none
// ==/UserScript==
/* eslint-env browser, es2022, greasemonkey */
/* global preact:readonly, htm:readonly */

/**
* Changelog
*
* 1.1 (Fixed Version)
* - fix: Added globals for ESlint configuration
*
* 1.0
* - Original script
*/


(function() {
    'use strict';

    const html = htm.bind(preact.h);

    setTimeout(() => {
        const forcedDiv = document.getElementById('forcediv');
        if (forcedDiv) forcedDiv.remove();
    }, 1000);

    // DEBUG: Merge saved settings with defaults. This makes updates safer.
    const defaultSettings = {
        minimal: false,
        cols: '3',
        tags_like: '',
        tags_dislike: '',
        cats_like: '',
        cats_dislike: '',
        preserve_tags: false,
        fewer_tags: false,
        hide_disliked: false,
    };

    let userSettings = { ...defaultSettings };
    const userSettings_saved = localStorage.getItem('HFviewer_settings');

    if (userSettings_saved) {
        try {
            // By spreading saved settings over defaults, we ensure new settings are not lost.
            userSettings = { ...defaultSettings, ...JSON.parse(userSettings_saved) };
        } catch(e) {
            logError(e);
        }
    }

    let cellidx = {
        'category': 1,
        'main': 2,
        'icons': 2,
        'time': 5,
        'size': 6,
        'snatches': 7,
        'seeders': 8,
        'leechers': 9,
        'uploader': 10
    };

   if (location.pathname === '/collages.php') {
        cellidx = {
            'category': 1,
            'main': 2,
            'icons': 2,
            'time': 0, //there is no time column
            'size': 3,
            'snatches': 4,
            'seeders': 5,
            'leechers': 6
        };
    }

    // FIXED: Updated column mapping for top10.php based on actual HTML structure
    if (location.pathname === '/top10.php') {
        cellidx = {
            'category': 2,
            'main': 3,
            'icons': 3,
            'time': 0, // Time column doesn't exist on top10 pages
            'size': 5,
            'snatches': 6,
            'seeders': 7,
            'leechers': 8,
            'uploader': 10
        };
    }

    const selectors = {
        id: selectorFn(row => {
            const torrentLink = row.querySelector('a[href*="torrents.php?id="]');
            const match = torrentLink?.href.match(/torrents\.php\?id=([\d]+)/);
            return match ? match[1] : null; // DEBUG: Check for match
        }),

        title: selectorFn(row => {
            // Primary selector: look for torrent link
            let torrentLink = row.querySelector('a[href*="torrents.php?id="]');
            if (torrentLink) {
                // Get the text content, stripping any HTML tags
                let title = torrentLink.textContent || torrentLink.innerText || '';
                title = title.trim();
                if (title) {
                    return title;
                }
            }
            // Fallback: look for any link in the main cell that might be the title
            const mainCell = row.querySelector(`td:nth-child(${cellidx.main})`);
            if (mainCell) {
                // Find the first substantial link that's not in the tags section
                const links = mainCell.querySelectorAll('a:not(.tags a)');
                for (const link of links) {
                    const linkText = (link.textContent || link.innerText || '').trim();
                    if (linkText && linkText.length > 3) { // Avoid short utility links
                        return linkText;
                    }
                }
            }
            return 'Unknown Title'; // Clean fallback
        }),
        uploader: selectorFn(row => {
            if (!cellidx.uploader) return null;
            const link = row.querySelector(`td:nth-child(${cellidx.uploader}) a`);
            return link ? { url: link.href, id: link.innerHTML || link.textContent } : null; // DEBUG: Check for link
        }),

        category: selectorFn(row => {
            const img = row.querySelector(`td:nth-child(${cellidx.category}) img`);
            if (!img) return null;
            const parentNode = img.parentNode;
            if (!parentNode) return null;
            // Get category info from the most reliable source
            const categoryTitle = img.title || img.alt || parentNode.title;
            const categoryUrl = parentNode.href || '#';
            return categoryTitle ? { url: categoryUrl, id: categoryTitle } : null;
        }),
        tags: selectorFn(row => {
            const tagNodes = row.querySelectorAll(`td:nth-child(${cellidx.main}) .tags a`);
            const tags = Array.from(tagNodes, node => node.innerHTML || node.textContent);
            const tagsNode = row.querySelector(`td:nth-child(${cellidx.main}) .tags`);
            return {
                tags,
                tagsMarkup: tagsNode?.innerHTML || '' // DEBUG: Check for tagsNode
            };
        }),
        cover: selectorFn(row => {
            const coverScript = row.querySelector(`td:nth-child(${cellidx.main}) script`)?.innerHTML;
            if (!coverScript) return ''; // DEBUG: Check if script exists

            //const re = location.origin.includes('pornbay.org') ? /src=([^>]+)/i : /src=\\"([^"]+)/i;
            const re = /src=\\"([^"]+)/i;
            const match = coverScript.match(re);
            return match ? match[1].replace(/\\/g, '') : ''; // DEBUG: Check for match
        }),

        time: selectorFn(row => {
            // DEBUG: Handle case where time column doesn't exist (e.g., top10.php)
            if (!cellidx.time) return { relative: '', absolute: '' };
            const timeTag = row.querySelector(`td:nth-child(${cellidx.time}) .time`);
            return timeTag ? { relative: timeTag.innerHTML, absolute: timeTag.title } : { relative: '', absolute: '' }; // DEBUG: Check for timeTag
        }),

        seeders: selectorFn(row => Number(row.querySelector(`td:nth-child(${cellidx.seeders})`)?.innerHTML) || 0), // DEBUG: Check and default to 0
        leechers: selectorFn(row => Number(row.querySelector(`td:nth-child(${cellidx.leechers})`)?.innerHTML) || 0), // DEBUG: Check and default to 0
        size: selectorFn(row => row.querySelector(`td:nth-child(${cellidx.size})`)?.innerHTML || 'N/A'), // DEBUG: Check and default
    };

    function selectorFn(fn) {
        return (row) => {
            try {
                return fn(row);
            } catch (e) {
                logError(e);
                return undefined;
            }
        };
    }

    function getTorrents(table) {
        // FIXED: Updated selector to handle both "torrent" and "torrent rowb" classes
        const rows = table.querySelectorAll('tr.torrent, tr[class*="torrent"]');
        const torrents = [];
        for (const row of rows) {
            const torrent = {};
            for (const selector in selectors) {
                torrent[selector] = selectors[selector](row);
            }
            if (torrent.id) { // Only add if we could parse a valid ID
                torrents.push(torrent);
            }
        }
        log(`Found ${torrents.length} torrents in table`);
        return torrents;
    }

    class ContentPrefs extends preact.Component {
        state = this.props.initialState;

        save = (e) => {
            e.preventDefault();
            // DEBUG: The entire state needs to be passed up to be saved.
            for (const key in this.state) {
                this.props.updateState(key, this.state[key]);
            }
            document.getElementById('contentPrefsDialog').close();
        }
// Recommended: Use <a href="https://github.com/allebady/Tag-Highlighter/blob/master/Emp%2B%2B_Tag_Highlighter07.user.js" target="_blank">Tag highlighter userscript</a> for a more powerful preference system. Enable "Preserve tags" setting once installed.
// will add at later date updated to work with HF
        render() {
            return html`
                <form onSubmit=${this.save}>
                    <p class="colhead prefs_notice">
                    </p>
                    <fieldset>
                        <legend>Tags you like (separated by spaces or commas)</legend>
                        <input value=${this.state.tags_like} onChange=${(e) => this.setState({ tags_like: e.target.value })} type="text" />
                    </fieldset>
                    <fieldset>
                        <legend>Tags you dislike (separated by spaces or commas)</legend>
                        <input value=${this.state.tags_dislike} onChange=${(e) => this.setState({ tags_dislike: e.target.value })} type="text" />
                    </fieldset>
                    <fieldset>
                        <legend>Categories you like (separated by spaces or commas)</legend>
                        <input value=${this.state.cats_like} onChange=${(e) => this.setState({ cats_like: e.target.value })} type="text" />
                    </fieldset>
                    <fieldset>
                        <legend>Categories you dislike (separated by spaces or commas)</legend>
                        <input value=${this.state.cats_dislike} onChange=${(e) => this.setState({ cats_dislike: e.target.value })} type="text" />
                    </fieldset>
                    <fieldset>
                        <legend>Options</legend>
                        <div>
                            <input checked=${this.state.hide_disliked} onChange=${(e) => this.setState({ hide_disliked: e.target.checked })} type="checkbox" id="prefs-hide_disliked" />
                            <label for="prefs-hide_disliked">Hide disliked</label>
                        </div>
                    </fieldset>
                    <input type="submit" value="Save" />
                </form>
            `;
        }
    }

    class View extends preact.Component {
        state = userSettings;

        updateState = (key, val) => {
            this.setState(prev => {
                const newState = { ...prev, [key]: val };
                localStorage.setItem('HFviewer_settings', JSON.stringify(newState));
                return newState;
            });
        }

        render() {
            const { torrents } = this.props;
            let className = "torrents";
            if (this.state.preserve_tags) className += ' preserved-tags';
            if (this.state.fewer_tags) className += ' fewer-tags';
            if (this.state.minimal) className += ' minimal';

            return html`
                <div class="view-controls">
                    <div>
                        <input checked=${this.state.minimal} onChange=${(e) => this.updateState('minimal', e.target.checked)} type="checkbox" id="view-minimal" />
                        <label for="view-minimal">Minimal</label>
                    </div>
                    <div>
                        <input checked=${this.state.preserve_tags} onChange=${(e) => this.updateState('preserve_tags', e.target.checked)} type="checkbox" id="view-preserve_tags" />
                        <label for="view-preserve_tags">Preserve Tags</label>
                    </div>
                    ${this.state.preserve_tags && html`
                        <div>
                            <input checked=${this.state.fewer_tags} onChange=${(e) => this.updateState('fewer_tags', e.target.checked)} type="checkbox" id="view-fewer_tags" />
                            <label for="view-fewer_tags">Fewer tags</label>
                        </div>
                    `}
                    <div>
                        <input value=${this.state.cols} onChange=${(e) => this.updateState('cols', e.target.value)} type="number" min="1" max="10" id="view-cols" />
                        <label for="view-cols">Columns</label>
                    </div>
                    <button onClick=${() => document.getElementById('contentPrefsDialog').showModal()}>
                        Edit content preferences
                    </button>
                    <dialog id="contentPrefsDialog">
                        <${ContentPrefs} initialState=${this.state} updateState=${this.updateState} />
                    </dialog>
                </div>
                <div class=${className}>
                    ${torrents.map(t => html`<${TorrentCard} key=${t.id} torrent=${t} prefs=${this.state} />`)}
                </div>
                <style>
                    .torrents {
                        padding: 10px;
                        display: grid;
                        grid-template-columns: repeat(${this.state.cols}, 1fr);
                        gap: 10px;
                    }
                </style>
            `;
        }
    }

    // DEBUG: Helper to correctly split preference strings into arrays
    const getPrefList = (str) => str.split(/[\s,]+/).filter(Boolean);

    function TorrentCard({ torrent, prefs }) {
        const disliked = isDisliked(torrent, prefs);
        if (disliked && prefs.hide_disliked) return null;

        const likedTag = isLikedTag(torrent, prefs);
        const likedCat = isLikedCat(torrent, prefs);
        const isLiked = likedTag || likedCat;

        return html`
            <div class="torrent HFviewer_card ${isLiked ? 'liked' : ''} ${disliked ? 'disliked' : ''}">
                <div class="card_inner">
                    <a class="card_cover" href=${`${location.origin}/torrents.php?id=${torrent.id}`}>
                        <img src="${torrent.cover}" loading="lazy" />
                    </a>
                    <div class="card_details">
                        <a href="${location.origin}/torrents.php?id=${torrent.id}">${torrent.title}</a>
                    </div>
                </div>
                <div class="card_meta">
                    <div class="card_dl_info">
                        <strong>${torrent.size}</strong>
                        <span><span style="color:#4fd227">↑</span><span>${torrent.seeders}</span></span>
                        <span>↓${torrent.leechers}</span>
                    </div>
                    <div class="card_icons" dangerouslySetInnerHTML=${{ __html: torrent.icons }} />
                </div>
                <div class="card_title">
                    ${torrent.category && html`<a class="card_category" href=${torrent.category.url}>${torrent.category.id}</a>`}
                    <a href="${location.origin}/torrents.php?id=${torrent.id}">${torrent.title}</a>
                </div>
                <${Tags} torrent=${torrent} prefs=${prefs} isLiked=${isLiked} />
            </div>
        `;
    }

    function Tags({ torrent, prefs, isLiked }) {
        if (prefs.preserve_tags) {
            return html`<div class="tags" dangerouslySetInnerHTML=${{ __html: torrent.tags.tagsMarkup }} />`;
        }
        // DEBUG: Only render liked tags if the item is liked because of a tag, not a category
        if (isLikedTag(torrent, prefs)) {
            const likedTagsInTorrent = getPrefList(prefs.tags_like).filter(t => torrent.tags.tags.includes(t));
            return html`
                <div class="card_tags">
                    ${likedTagsInTorrent.map(t => html`<a key=${t} href=${`${location.origin}/torrents.php?taglist=${t}`}>${t}</a>`)}
                </div>
            `;
        }
        return null;
    }

    function isDisliked(torrent, prefs) {
        const dislikedCats = getPrefList(prefs.cats_dislike);
        if (torrent.category?.id && dislikedCats.includes(torrent.category.id)) return true;

        const dislikedTags = getPrefList(prefs.tags_dislike);
        for (const tag of dislikedTags) {
            if (torrent.tags.tags.includes(tag)) return true;
        }
        return false;
    }

    function isLikedTag(torrent, prefs) {
        const likedTags = getPrefList(prefs.tags_like);
        for (const tag of likedTags) {
            if (torrent.tags.tags.includes(tag)) return true;
        }
        return false;
    }

    function isLikedCat(torrent, prefs) {
        if (!torrent.category?.id) return false;
        const likedCats = getPrefList(prefs.cats_like);
        return likedCats.includes(torrent.category.id);
    }

    /** Render */
    const torrentTables = document.querySelectorAll('.torrent_table, #torrent_table');
    if (torrentTables.length === 0) {
        log('No torrent tables found on this page.');
        return;
    }

    log(`Found ${torrentTables.length} torrent table(s) on page`);
    insertCSS(); // Inject CSS once at the beginning

    torrentTables.forEach((torrentTable, index) => {
        const torrents = getTorrents(torrentTable);
        if (torrents.length === 0) {
            log(`Could not parse any torrents from table ${index + 1}.`);
            return;
        }

        const container = document.createElement('div');
        container.className = 'view-container';
        torrentTable.parentNode.insertBefore(container, torrentTable.nextSibling);

        preact.render(preact.h(View, { torrents }), container);

        // Hide original table rows but keep header
        const toRemove = torrentTable.querySelectorAll('tr:not(.colhead):not(.head)');
        log(`Hiding ${toRemove.length} original rows from table ${index + 1}`);
        for (const e of toRemove) {
            e.style.display = 'none';
        }
    });

    /** styling */
    function insertCSS() {
        const originalCSS = `
            html body { font-family: BlinkMacSystemFont, system-ui, sans; }
            .view-container { background: #70839b; font-size: 14px; }
            .view-controls { background: #c6def6; display: flex; flex-direction: row; align-items: center; gap: 15px; padding: 10px; color: #111; }
            .view-controls button { padding: 2px 4px; }
            .HFviewer_card { display: flex; overflow: hidden; background: #222; border-radius: 10px; flex-direction: column; color: #ddd; }
            .minimal .HFviewer_card { border-radius: 5px; }
            .card_inner { display: flex; overflow: hidden; position: relative; }
            .HFviewer_card a:link { color: #8ba7e9; }
            .HFviewer_card a:hover { text-decoration: underline; }
            .HFviewer_card .tags { padding: 10px; display: flex; flex-direction: row; flex-wrap: wrap; gap: 3px; }
            .HFviewer_card a:visited { color: #a583a9; opacity: 0.8; }
            .card_cover { width: 100%; background-color: black; }
            .card_cover img { width: 100%; height: 100%; object-fit: contain; }
            .disliked .card_cover img { filter: blur(20px); }
            .liked { outline: 3px solid orange; }
            .HFviewer_card:has(.s-loved) { outline: 3px solid #3D9949; }
            .torrents .card_cover { aspect-ratio: 4/3; }
            .card_details { display: none; position: absolute; bottom: 0; right: 0; background: hsl(0deg 0% 0% / 79%); color: white; padding: 10px; left: 0; transform: translateY(100%); transition: 150ms ease; }
            .HFviewer_card:hover .card_details { display: block; transform: none; }
            .card_meta { padding: 10px; display: flex; flex-direction: row; justify-content: space-between; background: #333; }
            .card_dl_info { display: flex; flex-direction: row; align-items: center; gap: 4px; margin-left: 6px; }
            .card_dl_info strong { font-size:14px; }
            .card_dl_info span { font-size: 13px; color: #aaa; display: flex; }
            .card_title { padding: 10px; line-height: 1.5; font-size: 15px; }
            .card_category { background: #aaa; color: black !important; margin-right: 5px; padding: 1px 2px; font-size: 90%; font-weight: bold; border-radius: 3px; }
            .minimal .card_meta, .minimal .card_title, .minimal .card_tags, .minimal .tags { display: none; }
            #contentPrefsDialog { top: 50%; left: 50%; transform: translate(-50%, -50%); min-width: 300px; border: 1px solid #333; }
            #contentPrefsDialog form { padding: 15px; display: flex; flex-direction: column; gap: 10px; }
            #contentPrefsDialog::backdrop { background: rgba(0,0,0,0.5); }
            #contentPrefsDialog fieldset { display: flex; flex-direction: column; border: 0; gap: 3px; padding: 0; }
            .card_tags { padding: 0 10px 10px; display: flex; flex-wrap: wrap; gap: 5px; }
            .card_tags a { border: 1px solid #aaa; padding: 1px 3px; border-radius: 3px; }
            #content { max-width: none; width: 95%; }
            .prefs_notice { padding: 5px; background: #eee; border: 1px solid #ccc; }
            .prefs_notice a { text-decoration: underline; }
            .fewer-tags span[class="s-tag"] { display: none; }
        `;
        const tag = document.createElement('style');
        tag.type = 'text/css';
        tag.innerHTML = originalCSS.replace(/\s\s+/g, ' '); // Minify slightly
        document.head.appendChild(tag);
    }

    function log(arg) {
        if (typeof arg === 'string') console.log(`[HFviewer] ${arg}`);
        else console.log(`[HFviewer] `, arg);
    }

    function logError(e) {
        console.error('[HFviewer]', e);
    }
})();
