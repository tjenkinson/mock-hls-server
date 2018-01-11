const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const { parsePlaylist, parseVariantPlaylist } = require('../src/playlist-parser');

const PLAYLIST = fs.readFileSync(path.resolve(__dirname, 'fixtures/playlist.m3u8'), 'utf8');
const VARIANT_PLAYLIST = fs.readFileSync(path.resolve(__dirname, './fixtures/master.m3u8'), 'utf8');

describe('PlaylistParser', () => {
    it('parses a playlist correctly', () => {
        expect(parsePlaylist(PLAYLIST)).to.deep.equal([
            { raw: '#EXTM3U' },
            { raw: '#EXT-X-TARGETDURATION:6' },
            { raw: '#EXT-X-VERSION:3' },
            { raw: '#EXT-X-MEDIA-SEQUENCE:0' },
            { raw: '#EXT-X-PLAYLIST-TYPE:VOD' },
            { raw: '#EXT-X-INDEPENDENT-SEGMENTS' },
            { raw: '#EXTINF:6.00000,' },
            { raw: '#EXT-X-BITRATE:377' },
            { raw: 'fileSequence0.ts',
                metadata: { type: 'url', time: 0, startIndex: 6, end: false } },
            { raw: '#EXTINF:6.00000,' },
            { raw: '#EXT-X-BITRATE:385' },
            { raw: 'fileSequence1.ts',
                metadata: { type: 'url', time: 6, startIndex: 9, end: false } },
            { raw: '#EXTINF:6.00000,' },
            { raw: '#EXT-X-BITRATE:388' },
            { raw: 'fileSequence2.ts',
                metadata: { type: 'url', time: 12, startIndex: 12, end: false } },
            { raw: '#EXTINF:6.00000,' },
            { raw: '#EXT-X-BITRATE:378' },
            { raw: 'fileSequence3.ts',
                metadata: { type: 'url', time: 18, startIndex: 15, end: true } },
            { raw: '#EXT-X-ENDLIST' }
        ]);
    });

    it('parses a variant playlist correctly', () => {
        expect(parseVariantPlaylist(VARIANT_PLAYLIST)).to.deep.equal([
            { raw: '#EXTM3U' },
            { raw: '#EXT-X-VERSION:6' },
            { raw: '#EXT-X-INDEPENDENT-SEGMENTS' },
            { raw: '' },
            { raw: '#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=2218327,BANDWIDTH=2227464,CODECS="avc1.640020,mp4a.40.2",RESOLUTION=960x540,FRAME-RATE=60.000,CLOSED-CAPTIONS="cc1",AUDIO="aud1",SUBTITLES="sub1"' },
            { raw: 'v5/prog_index.m3u8', metadata: { type: 'url' } },
            { raw: '#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=8144656,BANDWIDTH=8178040,CODECS="avc1.64002a,mp4a.40.2",RESOLUTION=1920x1080,FRAME-RATE=60.000,CLOSED-CAPTIONS="cc1",AUDIO="aud1",SUBTITLES="sub1"' },
            { raw: 'v9/prog_index.m3u8', metadata: { type: 'url' } },
            { raw: '' },
            { raw: '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud1",LANGUAGE="en",NAME="English",AUTOSELECT=YES,DEFAULT=YES,CHANNELS="2",URI="a1/prog_index.m3u8"' }
        ]);
    });
});