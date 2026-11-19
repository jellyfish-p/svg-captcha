'use strict';

const {deflateSync} = require('node:zlib');

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
// PNG chunks carry an IEEE CRC-32 of the type and data.
const crcTable = Uint32Array.from({length: 256}, (_, byte) => {
	let crc = byte;
	for (let i = 0; i < 8; i++) {
		crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
	}
	return crc;
});

function chunk(type, data) {
	const bytes = Buffer.alloc(data.length + 12);
	bytes.writeUInt32BE(data.length);
	bytes.write(type, 4, 'ascii');
	data.copy(bytes, 8);
	let crc = 0xffffffff;
	for (let index = 4; index < bytes.length - 4; index++) {
		crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[index]) & 0xff];
	}
	bytes.writeUInt32BE((crc ^ 0xffffffff) >>> 0, bytes.length - 4);
	return bytes;
}

module.exports = function encodePng(width, height, scanlines) {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width);
	header.writeUInt32BE(height, 4);
	header[8] = 8;
	header[9] = 2; // RGB
	return Buffer.concat([
		signature,
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(scanlines)),
		chunk('IEND', Buffer.alloc(0))
	]);
};
