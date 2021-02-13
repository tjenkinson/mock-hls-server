const EXTINF = '#EXTINF:';

// parse non-variant playlist
// returns null if parsing fails
// otherwise returns a function that returns a reader that gets the following for each line of the playlist:
// { raw: 'line contents', metadata }

// where metadata will be undefined or
// { type: 'url', time, end }
// { type: 'endlist' }

function parsePlaylist(playlist, infinite) {
    playlist = playlist.trim().split(/\r?\n/g).map((line) => line.trim());
    if (playlist[0] !== '#EXTM3U') {
        return null;
    }
    if (playlist.some((line) => line.indexOf('#EXT-X-STREAM-INF:') === 0)) {
        // variant playlist
        return null;
    }

    return () => {
        let startIndex = 0;
        let time = 0;
        let segmentDuration = 0;
        let i = -1;
        let increasingI = -1;
        let urlsStart = 0;

        const read = () => {
            if (playlist.length === 0) {
                return null;
            }

            i++;
            increasingI++;

            if (i >= playlist.length) {
                if (!infinite) {
                    return null;
                }
                i = urlsStart - 1;
                return { raw: '#EXT-X-DISCONTINUITY' };
            }

            const line = playlist[i];
            const data = { raw: line };
            if (line.indexOf(EXTINF) === 0) {
                const newDuration = parseFloat(line.substring(EXTINF.length, line.length - 1));
                if (!isNaN(newDuration)) {
                    segmentDuration = newDuration;
                }
                startIndex = increasingI;
                if (!urlsStart) {
                    urlsStart = i;
                }
            } else if (line && line[0] !== '#') {
                data.metadata = { type: 'url', time, startIndex, end: !infinite && playlist[i+1] === '#EXT-X-ENDLIST' };
                time += segmentDuration;
                segmentDuration = 0;
            } else if (line === '#EXT-X-ENDLIST') {
                if (infinite) {
                    increasingI--;
                    return read();
                } 
                data.metadata = { type: 'endlist' };
            }
            return data;
        };

        return {
            read
        };
    };
}

function parseVariantPlaylist(playlist) {
    playlist = playlist.trim().split(/\r?\n/g).map((line) => line.trim());
    if (playlist[0] !== '#EXTM3U') {
        return null;
    }
    if (!playlist.some((line) => line.indexOf('#EXT-X-STREAM-INF:') === 0)) {
        // not variant playlist
        return null;
    }

    return () => {
        let i = -1;
        return {
            read() {
                i++;
                if (i >= playlist.length) {
                    return null;
                }
                let line = playlist[i];

                const data = { raw: line };
                if (line && line[0] !== '#') {
                    data.metadata = { type: 'url' };
                }
                return data;
            }
        };
    };
}

module.exports = {
    parsePlaylist,
    parseVariantPlaylist
};
