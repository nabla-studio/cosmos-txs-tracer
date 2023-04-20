import { Stream, Listener } from 'xstream';

export const streamToPromise = <T>(stream: Stream<T>, timeout: number) =>
	new Promise((resolve, reject) => {
		let result: T | null = null;

		const timer = setTimeout(() => {
			reject();
		}, timeout);

		const listener: Listener<T> = {
			next: listenerResult => {
				result = listenerResult;
			},
			error: err => {
				console.error(err);
				reject(err);
				clearTimeout(timer);
			},
			complete: () => {
				resolve(result);
				clearTimeout(timer);
			},
		};

		return stream.addListener(listener);
	});
