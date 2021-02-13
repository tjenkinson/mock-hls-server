const express = require('express');
const path = require('path');
const querystring = require('querystring');
const fetch = require('node-fetch');
const UrlToolkit = require('url-toolkit');
const winston = require('winston');
const PlaylistParser = require('./playlist-parser');

const PROXY_PATH = '/proxy';
const PROXY_QUERY_PARAM = 'url';

class MockHLSServer {
    constructor({ host = 'localhost', port = 8080, windowSize = 10, initialDuration = 20, loop = false, logLevel = 'none' } = {}) {
        this._logger = new winston.Logger({
            transports: logLevel !== 'none' ? [
                new winston.transports.Console({
                    level: logLevel,
                    handleExceptions: true,
                    exitOnError: false
                })
            ] : []
        });
        this._proxyBaseUrl = 'http://' + host + ':' + port + PROXY_PATH + '?' + PROXY_QUERY_PARAM + '=';
        this._startTime = null;
        this._initialDuration = initialDuration;
        this._windowSize = windowSize;
        this._loop = loop;

        const app = express();
        app.get(PROXY_PATH, (req, res, next) => {
            const url = req.query.url;
            if (!url) {
                throw new Error('\'url\' query param missing.');
            }
            this._logger.debug('Got request.', url);
            fetch(url).then((fetchRes) => Promise.all([Promise.resolve(fetchRes), fetchRes.text()])).then(([ fetchRes, content ]) => {
                this._logger.debug('Got response from proxy.', url, fetchRes.status);
                if (!(fetchRes.status >= 200 && fetchRes.status < 300)) {
                    this._logger.warn('Got ' + fetchRes.status + ' response code.', url);
                }
                res.status(fetchRes.status);
                res.set('Access-Control-Allow-Origin', '*');
                res.set('content-type', fetchRes.headers.get('content-type'));
                if (path.extname(url).indexOf('.m3u8') === 0) {
                    this._logger.debug('Handling playlist request.', url);
                    res.send(this._handlePlaylistResponse(content, url));
                } else {
                    res.send(content);
                }
                this._logger.debug('Sent response.', url);
            }).catch((e) => {
                this._logger.error('Error proxying request.', url, e);
                next(e);
            });
        });

        this._server = app.listen(port, host, () => {
            this._logger.info('Started on ' + host + ':' + port + '!');
        });
    }
    
    reset() {
        this._startTime = null;
        this._logger.info('Reset.');
    }
    
    stop() {
        this._server.close();
        this._logger.info('Stopped.');
    }

    _getTime() {
        return this._startTime ? (Date.now() - this._startTime) / 1000 : 0;
    }

    _handlePlaylistResponse(body, playlistUrl) {
        if (!this._startTime) {
            this._startTime = Date.now() - (this._initialDuration * 1000);
            this._logger.debug('Started stream.');
        }
        let parsedPlaylist, parsedVariantPlaylist;
        if (parsedPlaylist = PlaylistParser.parsePlaylist(body, this._loop)) {
            this._logger.debug('Building playlist response.');
            return this._buildPlaylistResponse(parsedPlaylist, playlistUrl);
        } else if (parsedVariantPlaylist = PlaylistParser.parseVariantPlaylist(body)) {
            this._logger.debug('Building variant playlist response.');
            return this._buildVariantPlaylistResponse(parsedVariantPlaylist, playlistUrl);
        } else {
            this._logger.warn('Unable to parse playlist.', playlistUrl);
            return body;
        }
    }

    _buildPlaylistResponse(parsedPlaylist, playlistUrl) {
        const currentTime = this._getTime();
        const windowSize = this._windowSize;
        let { header, rest: visibleArea, reachedEnd } = this._splitPlaylistIntoHeaderAndRest(parsedPlaylist, currentTime);
        let mediaSequence = -1;
        if (windowSize !== null) {
            // we should remove the content from the start of the playlist that has expired
            const startTime = Math.max(0, currentTime - windowSize);
            let visibleAreaStart = 0;
            visibleArea.some((line) => {
                if (line.metadata && line.metadata.type === 'url') {
                    if (line.metadata.time > startTime) {
                        return true;
                    }
                    mediaSequence++;
                    visibleAreaStart = line.metadata.startIndex - header.length;
                }
                return false;
            });
            visibleArea = visibleArea.slice(visibleAreaStart);
        }
        // remove the playlist type if it is set because we are pretending it is live
        // remove the media seauence tag if it is there because we will rewrite it later
        header = header.filter((line) => {
            return !/(^#EXT-X-PLAYLIST-TYPE:)|(^#EXT-X-MEDIA-SEQUENCE:)/.test(line.raw);
        });
        // remove the endlist tag if it is there because we will add it later if necessary
        visibleArea = visibleArea.filter((line) => line.raw !== '#EXT-X-ENDLIST');
        if (windowSize !== null) {
            header.splice(1, 0, { raw: '#EXT-X-MEDIA-SEQUENCE:' + mediaSequence });
        } else {
            header.splice(1, 0, { raw: '#EXT-X-PLAYLIST-TYPE:EVENT' });
            if (reachedEnd) {
                visibleArea.push({ raw: '#EXT-X-ENDLIST' });
            }
        }
        return [ ...header, ...visibleArea ].map((line) => {
            if (line.metadata && line.metadata.type === 'url') {
                return this._rewriteUrl(playlistUrl, line.raw, false);
            } else if (line.raw[0] === '#') {
                return this._rewriteTagUrl(line.raw, playlistUrl);
            }
            return line.raw;
        }).join('\r\n') + '\r\n';
    }

    _buildVariantPlaylistResponse(parsedPlaylist, playlistUrl) {
        let line = null;
        const res = [];
        const reader = parsedPlaylist();
        while(line = reader.read()) {
            if (line.metadata && line.metadata.type === 'url') {
                res.push(this._rewriteUrl(playlistUrl, line.raw));
            } else if (line.raw[0] === '#') {
                res.push(this._rewriteTagUrl(line.raw, playlistUrl));
            } else {
                res.push(line.raw);
            }
        }
        return res.join('\r\n') + '\r\n';
    }

    _splitPlaylistIntoHeaderAndRest(parsedPlaylist, currentTime) {
        let headerEnd = 0;
        let visibleAreaEnd = 0;

        const lines = [];
        let line = null;
        let reachedEnd = true;
        let i = -1;
        const reader = parsedPlaylist();
        while(line = reader.read()) {
            i++;
            lines.push(line);
            if (line.metadata && line.metadata.type === 'url') {
                if (!headerEnd) {
                    headerEnd = line.metadata.startIndex;
                }
                if (line.metadata.time > currentTime) {
                    reachedEnd = false;
                    break;
                }
                visibleAreaEnd = i + 1;
            }
        }
        return {
            header: lines.slice(0, headerEnd),
            rest: lines.slice(headerEnd, reachedEnd ? lines.length : visibleAreaEnd),
            reachedEnd
        };
    }

    _rewriteUrl(baseUrl, url, throughProxy = true) {
        const absoluteURL = UrlToolkit.buildAbsoluteURL(baseUrl, url, { alwaysNormalize: true });
        return (
            throughProxy
            ? this._proxyBaseUrl + querystring.escape(absoluteURL)
            : absoluteURL
        );
    }

    // replace urls in tags (URI="X") with absolute ones
    _rewriteTagUrl(line, baseUrl) {
        return line.replace(/URI="(.*?)"/g, (match) => {
            const url = match.slice(5, -1);
            const absoluteURL = UrlToolkit.buildAbsoluteURL(baseUrl, url, { alwaysNormalize: true });
            return 'URI="' + this._proxyBaseUrl + querystring.escape(absoluteURL) + '"';
        });
    }
}

module.exports = MockHLSServer;
