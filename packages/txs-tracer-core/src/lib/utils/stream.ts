import { Stream, Listener } from 'xstream';

export const streamToPromise = <T>(stream: Stream<T>) =>
	new Promise((resolve, reject) => {
		let result: T | null = null;

		const listener: Listener<T> = {
			next: listenerResult => {
				result = listenerResult;
			},
			error: err => {
				console.error(err);
				reject(err);
			},
			complete: () => {
				resolve(result);
			},
		};

		return stream.addListener(listener);
	});
