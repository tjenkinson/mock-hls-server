const EXTINF = '#EXTINF:'

// parse non-varient playlist
// returns null if parsing fails
// otherwise returns an array for each line of the playlist like
// [
//   { raw: 'line contents', metadata },
//   ...
// ]
// where metadata will be undefined or
// { type: 'url', time, end }
function parsePlaylist(playlist) {
    playlist = playlist.trim().split(/\r?\n/g).map((line) => line.trim());
    if (playlist[0] !== '#EXTM3U') {
        return null;
    }
    if (playlist.some((line) => line.indexOf('#EXT-X-STREAM-INF:') === 0)) {
        // variant playlist
        return null;
    }
    
    let startIndex = 0;
    let time = 0;
    let segmentDuration = 0;
    return playlist.map((line, i) => {
        const data = { raw: line };
        if (line.indexOf(EXTINF) === 0) {
            const newDuration = parseFloat(line.substring(EXTINF.length, line.length - 1));
            if (!isNaN(newDuration)) {
                segmentDuration = newDuration;
            }
            startIndex = i;
        } else if (line && line[0] !== '#') {
            data.metadata = { type: 'url', time, startIndex, end: playlist[i+1] === '#EXT-X-ENDLIST' };
            time += segmentDuration;
            segmentDuration = 0;
        }
        return data;
    });
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
    
    return playlist.map((line, i) => {
        const data = { raw: line };
        if (line && line[0] !== '#') {
            data.metadata = { type: 'url' };
        }
        return data;
    });
}

module.exports = {
    parsePlaylist,
    parseVariantPlaylist
};