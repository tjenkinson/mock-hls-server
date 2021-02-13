const { expect } = require('chai');
const path = require('path');
const fs = require('fs');

const expressStub = () => ({
    get: () => {},
    listen: (_host, _port, cb) => cb()
});

const proxyquire =  require('proxyquire');
const MockHLSServer = proxyquire('../src/mock-hls-server', {
    express: expressStub
});

const PLAYLIST = fs.readFileSync(path.resolve(__dirname, 'fixtures/playlist.m3u8'), 'utf8');
const VARIANT_PLAYLIST = fs.readFileSync(path.resolve(__dirname, './fixtures/master.m3u8'), 'utf8');

describe('MockHLSServer', () => {
    let server;

    afterEach(() => server = undefined);
    
    it('can be constructed with no options', () => {
        server = new MockHLSServer();
        expect(server).to.be.ok;
    });

    describe('_handlePlaylistResponse', () => {
        it('starts the stream on the first request', () => {
            server = new MockHLSServer();
            expect(server._startTime).to.be.null;
            server._handlePlaylistResponse(PLAYLIST, 'http://example.invalid/playlist.m3u8');
            expect(server._startTime).to.not.be.null;
        });

        // [false, true].forEach((loop) => {
        [true].forEach((loop) => {
            describe(`with loop option ${loop ? 'enabled' : 'disabled'}`, () => {
                describe('in live mode', () => {  
                    beforeEach(() => server = new MockHLSServer({ loop }));
                    describe('correcty handles a playlist response', () => {
                        it('when no time has passed', () => {
                            server._getTime = () => 0;
                            expect(
                                server._handlePlaylistResponse(PLAYLIST, 'http://example.invalid/playlist.m3u8').split('\r\n')
                            ).to.deep.equal([
                                '#EXTM3U',
                                '#EXT-X-MEDIA-SEQUENCE:0',
                                '#EXT-X-TARGETDURATION:6',
                                '#EXT-X-VERSION:3',
                                '#EXT-X-INDEPENDENT-SEGMENTS',
                                '#EXTINF:6.00000,',
                                '#EXT-X-BITRATE:377',
                                '# Original URL: fileSequence0.ts',
                                'http://example.invalid/fileSequence0.ts',
                                ''
                            ]);
                        });

                        it('when 20 seconds has passed', () => {
                            server._getTime = () => 20;
                            expect(
                                server._handlePlaylistResponse(PLAYLIST, 'http://example.invalid/playlist.m3u8').split('\r\n')
                            ).to.deep.equal([
                                '#EXTM3U',
                                '#EXT-X-MEDIA-SEQUENCE:1',
                                '#EXT-X-TARGETDURATION:6',
                                '#EXT-X-VERSION:3',
                                '#EXT-X-INDEPENDENT-SEGMENTS',
                                '#EXTINF:6.00000,',
                                '#EXT-X-BITRATE:385',
                                '# Original URL: fileSequence1.ts',
                                'http://example.invalid/fileSequence1.ts',
                                '#EXTINF:6.00000,',
                                '#EXT-X-BITRATE:388',
                                '# Original URL: fileSequence2.ts',
                                'http://example.invalid/fileSequence2.ts',
                                '#EXTINF:6.00000,',
                                '#EXT-X-BITRATE:378',
                                '# Original URL: fileSequence3.ts',
                                'http://example.invalid/fileSequence3.ts',
                                ''
                            ]);
                        });

                        it('when 25 seconds has passed', () => {
                            server._getTime = () => 25;
                            expect(
                                server._handlePlaylistResponse(PLAYLIST, 'http://example.invalid/playlist.m3u8').split('\r\n')
                            ).to.deep.equal([
                                '#EXTM3U',
                                '#EXT-X-MEDIA-SEQUENCE:2',
                                '#EXT-X-TARGETDURATION:6',
                                '#EXT-X-VERSION:3',
                                '#EXT-X-INDEPENDENT-SEGMENTS',
                                '#EXTINF:6.00000,',
                                '#EXT-X-BITRATE:388',
                                '# Original URL: fileSequence2.ts',
                                'http://example.invalid/fileSequence2.ts',
                                '#EXTINF:6.00000,',
                                '#EXT-X-BITRATE:378',
                                '# Original URL: fileSequence3.ts',
                                'http://example.invalid/fileSequence3.ts',
                                ...(loop ? [
                                    '#EXT-X-DISCONTINUITY',
                                    '#EXTINF:6.00000,',
                                    '#EXT-X-BITRATE:377',
                                    '# Original URL: fileSequence0.ts',
                                    'http://example.invalid/fileSequence0.ts',
                                ] : []),
                                ''
                            ]);
                        });

                        it('when 10000 seconds has passed', () => {
                            server._getTime = () => 10000;
                            expect(
                                server._handlePlaylistResponse(PLAYLIST, 'http://example.invalid/playlist.m3u8').split('\r\n')
                            ).to.deep.equal(!loop ? [
                                '#EXTM3U',
                                '#EXT-X-MEDIA-SEQUENCE:3',
                                '#EXT-X-TARGETDURATION:6',
                                '#EXT-X-VERSION:3',
                                '#EXT-X-INDEPENDENT-SEGMENTS',
                                '#EXTINF:6.00000,',
                                '#EXT-X-BITRATE:378',
                                '# Original URL: fileSequence3.ts',
                                'http://example.invalid/fileSequence3.ts',
                                ''
                            ] : [
                                '#EXTM3U',
                                '#EXT-X-MEDIA-SEQUENCE:1665',
                                '#EXT-X-TARGETDURATION:6',
                                '#EXT-X-VERSION:3',
                                '#EXT-X-INDEPENDENT-SEGMENTS',
                                '#EXTINF:6.00000,',
                                '#EXT-X-BITRATE:385',
                                '# Original URL: fileSequence1.ts',
                                'http://example.invalid/fileSequence1.ts',
                                '#EXTINF:6.00000,',
                                '#EXT-X-BITRATE:388',
                                '# Original URL: fileSequence2.ts',
                                'http://example.invalid/fileSequence2.ts',
                                ''
                            ]);
                        });
                    });

                    it('correcty handles a variant playlist response', () => {
                        expect(
                            server._handlePlaylistResponse(VARIANT_PLAYLIST, 'http://example.invalid/playlist.m3u8').split('\r\n')
                        ).to.deep.equal([
                            '#EXTM3U',
                            '#EXT-X-VERSION:6',
                            '#EXT-X-INDEPENDENT-SEGMENTS',
                            '',
                            '#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=2218327,BANDWIDTH=2227464,CODECS="avc1.640020,mp4a.40.2",RESOLUTION=960x540,FRAME-RATE=60.000,CLOSED-CAPTIONS="cc1",AUDIO="aud1",SUBTITLES="sub1"',
                            '# Original URL: v5/prog_index.m3u8',
                            'http://localhost:8080/proxy?url=http%3A%2F%2Fexample.invalid%2Fv5%2Fprog_index.m3u8',
                            '#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=8144656,BANDWIDTH=8178040,CODECS="avc1.64002a,mp4a.40.2",RESOLUTION=1920x1080,FRAME-RATE=60.000,CLOSED-CAPTIONS="cc1",AUDIO="aud1",SUBTITLES="sub1"',
                            '# Original URL: v9/prog_index.m3u8',
                            'http://localhost:8080/proxy?url=http%3A%2F%2Fexample.invalid%2Fv9%2Fprog_index.m3u8',
                            '',
                            '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud1",LANGUAGE="en",NAME="English",AUTOSELECT=YES,DEFAULT=YES,CHANNELS="2",URI="http://localhost:8080/proxy?url=http%3A%2F%2Fexample.invalid%2Fa1%2Fprog_index.m3u8"',
                            ''
                        ]);
                    });
                });

                describe('in event mode', () => {  
                    beforeEach(() => server = new MockHLSServer({ loop, windowSize: null }));
                    describe('correcty handles a playlist response', () => {
                        it('when no time has passed', () => {
                            server._getTime = () => 0;
                            expect(
                                server._handlePlaylistResponse(PLAYLIST, 'http://example.invalid/playlist.m3u8').split('\r\n')
                            ).to.deep.equal([
                                '#EXTM3U',
                                '#EXT-X-PLAYLIST-TYPE:EVENT',
                                '#EXT-X-TARGETDURATION:6',
                                '#EXT-X-VERSION:3',
                                '#EXT-X-INDEPENDENT-SEGMENTS',
                                '#EXTINF:6.00000,',
                                '#EXT-X-BITRATE:377',
                                '# Original URL: fileSequence0.ts',
                                'http://example.invalid/fileSequence0.ts',
                                ''
                            ]);
                        });

                        it('when 20 seconds has passed', () => {
                            server._getTime = () => 20;
                            expect(
                                server._handlePlaylistResponse(PLAYLIST, 'http://example.invalid/playlist.m3u8').split('\r\n')
                            ).to.deep.equal([
                                '#EXTM3U',
                                '#EXT-X-PLAYLIST-TYPE:EVENT',
                                '#EXT-X-TARGETDURATION:6',
                                '#EXT-X-VERSION:3',
                                '#EXT-X-INDEPENDENT-SEGMENTS',
                                '#EXTINF:6.00000,',
                                '#EXT-X-BITRATE:377',
                                '# Original URL: fileSequence0.ts',
                                'http://example.invalid/fileSequence0.ts',
                                '#EXTINF:6.00000,',
                                '#EXT-X-BITRATE:385',
                                '# Original URL: fileSequence1.ts',
                                'http://example.invalid/fileSequence1.ts',
                                '#EXTINF:6.00000,',
                                '#EXT-X-BITRATE:388',
                                '# Original URL: fileSequence2.ts',
                                'http://example.invalid/fileSequence2.ts',
                                '#EXTINF:6.00000,',
                                '#EXT-X-BITRATE:378',
                                '# Original URL: fileSequence3.ts',
                                'http://example.invalid/fileSequence3.ts',
                                ...(!loop ? ['#EXT-X-ENDLIST'] : []),
                                ''
                            ]);
                        });

                        it('when 10000 seconds has passed', () => {
                            server._getTime = () => 10000;
                            const response = server._handlePlaylistResponse(PLAYLIST, 'http://example.invalid/playlist.m3u8').split('\r\n');
                            if (!loop) {
                                expect(response).to.deep.equal([
                                    '#EXTM3U',
                                    '#EXT-X-PLAYLIST-TYPE:EVENT',
                                    '#EXT-X-TARGETDURATION:6',
                                    '#EXT-X-VERSION:3',
                                    '#EXT-X-INDEPENDENT-SEGMENTS',
                                    '#EXTINF:6.00000,',
                                    '#EXT-X-BITRATE:377',
                                    '# Original URL: fileSequence0.ts',
                                    'http://example.invalid/fileSequence0.ts',
                                    '#EXTINF:6.00000,',
                                    '#EXT-X-BITRATE:385',
                                    '# Original URL: fileSequence1.ts',
                                    'http://example.invalid/fileSequence1.ts',
                                    '#EXTINF:6.00000,',
                                    '#EXT-X-BITRATE:388',
                                    '# Original URL: fileSequence2.ts',
                                    'http://example.invalid/fileSequence2.ts',
                                    '#EXTINF:6.00000,',
                                    '#EXT-X-BITRATE:378',
                                    '# Original URL: fileSequence3.ts',
                                    'http://example.invalid/fileSequence3.ts',
                                    '#EXT-X-ENDLIST',
                                    ''
                                ]);
                            } else {
                                expect(response.length).to.equal(7090);
                                expect(response.slice(-9)).to.deep.equal([
                                    '#EXTINF:6.00000,',
                                    '#EXT-X-BITRATE:385',
                                    '# Original URL: fileSequence1.ts',
                                    'http://example.invalid/fileSequence1.ts',
                                    '#EXTINF:6.00000,',
                                    '#EXT-X-BITRATE:388',
                                    '# Original URL: fileSequence2.ts',
                                    'http://example.invalid/fileSequence2.ts',
                                    ''
                                ]);
                            }
                        });
                    });
                });
            });
        });
    });
});
