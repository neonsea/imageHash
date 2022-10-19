/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/restrict-plus-operands */

import type {ComparisonOptions} from '../typing';
import type {DistanceResult} from '../typing/structures';

import {readFileSync} from 'fs';
import sharp from 'sharp';

export default class PerceptualHash {
	private readonly size: number;
	private readonly lowSize: number;

	constructor() {
		this.size = 32;
		this.lowSize = 8;
	}

	public async execute(image: Buffer) {
		image = await sharp(image)
			.grayscale()
			.resize(this.size, this.size, {fit: 'fill'})
			.rotate()
			.raw()
			.toBuffer();

		const signal = new Array(this.size);

		for (let x = 0; x < this.size; x++) {
			signal[x] = new Array(this.size);
			for (let y = 0; y < this.size; y++) {
				signal[x][y] = image[this.size * (y + x)];
			}
		}

		const sqrt = this._setSqrt();
		const cosine = this._setCosine();

		const dct = this._initDct(signal, cosine, sqrt);

		let finalSum = 0;

		for (let x = 0; x < this.lowSize; x++) {
			for (let y = 0; y < this.lowSize; y++) {
				finalSum += dct[x + 1][y + 1];
			}
		}

		const average = finalSum / (this.lowSize * this.lowSize);

		let hash = '';

		for (let x = 0; x < this.lowSize; x++) {
			for (let y = 0; y < this.lowSize; y++) {
				hash += dct[x + 1][y + 1] > average ? '1' : '0';
			}
		}

		return hash;
	}

	public async distance(imageA: Buffer, imageB: Buffer, humanize: boolean): Promise<DistanceResult> {
		const hash1 = await this.execute(imageA);
		const hash2 = await this.execute(imageB);

		const _distance = this.distanceHash(hash1, hash2);

		const result: DistanceResult = {distance: _distance, hashes: {hashA: hash1, hashB: hash2}};

		if (humanize) {
			if (_distance === 0) {
				result.distance = 'identical';
			} else if (_distance > 0 && _distance < 5) {
				result.distance = 'high similarity';
			} else if (_distance > 5 && _distance < 10) {
				result.distance = 'low similarity';
			} else {
				result.distance = 'completely different';
			}
		}

		return result;
	}

	public distanceHash(a: string, b: string) {
		let count = 0;
		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) {
				count++;
			}
		}

		return count;
	}

	private _setCosine(): number[] {
		const {size} = this;
		const cosArray = new Array(size);

		for (let i = 0; i < size; i++) {
			cosArray[i] = new Array(size);
			for (let n = 0; n < size; n++) {
				cosArray[i][n] = Math.cos(((2 * (i + 1)) / (2.0 * size)) * n * Math.PI);
			}
		}

		return cosArray;
	}

	private _setSqrt(): number[] {
		const {size} = this;
		const c = new Array(size);

		for (let i = 1; i < size; i++) {
			c[i] = 1;
		}

		c[0] = 1 / Math.sqrt(2.0);

		return c;
	}

	private _initDct(signal: number[][], cos: any, sqrt: number[]) {
		const {size} = this;
		const sampleArr = new Array(size);

		console.log(size, sampleArr);

		for (let u = 0; u < size; u++) {
			sampleArr[u] = new Array(size);
			for (let v = 0; v < size; v++) {
				let sum = 0;
				for (let i = 0; i < size; i++) {
					for (let j = 0; j < size; j++) {
						sum += cos[i][u] * cos[j][v] * signal[i][j];
					}
				}

				sum *= (sqrt[u] * sqrt[v]) / 4;
				sampleArr[u][v] = sum;
			}
		}

		return sampleArr;
	}
}