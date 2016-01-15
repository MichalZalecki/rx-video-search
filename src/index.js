import Rx from "rx";
import Cycle from "@cycle/core";
import { makeDOMDriver, h1, div, input, ul, li, a } from "@cycle/dom";
import { makeHTTPDriver } from "@cycle/http";
import storageDriver from "@cycle/storage";
import { YT_API_URL } from "app/config";

function YouTubeVideo({ HTTP, query$ }) {
  const URL = YT_API_URL;

  const request$ = query$.map(query => ({
    method: "GET",
    url: `${URL}&q=${query}`,
  }));

  const response$ = HTTP
    .filter(res$ => res$.request.url.indexOf(URL) === 0)
    .mergeAll()
    .map(response => response.body.items)
    .map(videos => videos.map(video => ({
      title: video.snippet.title,
      url: `https://youtube.com/watch?v=${video.id.videoId}`,
    })));

  return {
    request$,
    response$,
  };
}

function intent({ DOM }) {
  const query$ = DOM.select(".query").events("input")
    .map(e => e.target.value)
    .filter(str => str.length > 2)
    .debounce(300);

  return { query$ };
}

function store(reducer$, initialState$) {
  return initialState$
    .merge(reducer$)
    .scan((state, reducer) => reducer(state))
    .shareReplay(1);
}

function model({ actions, videos$, localStorage }) {
  const newQuery$ = actions.query$.map(query => state => ({ ...state, query }));
  const newVideos$ = videos$.map(videos => state => ({ ...state, videos }));

  const reducer$ = Rx.Observable.merge(newQuery$, newVideos$);
  const defaultState$ = Rx.Observable.just({ query: "", videos: [] });
  const initialState$ = localStorage.getItem("app").take(1)
    .map(serialized => JSON.parse(serialized))
    .withLatestFrom(defaultState$, (state, init) => state ? state : init);
  const state$ = store(reducer$, initialState$);

  return state$;
}

function view(state$) {
  return state$.map(state => div([
    input(".query", { type: "search" }),
    h1([`Search results from "${state.query}"`]),
    ul(state.videos.map(video => li([a({ href: video.url }, [video.title])])))
  ]));
}

function main(sources) {
  const actions = intent(sources);
  const youTubeVideo = YouTubeVideo({ HTTP: sources.HTTP, query$: aaa.query$ });
  const state$ = model({ actions, videos$: youTubeVideo.response$, localStorage: sources.storage.local });
  const storage$ = state$.map(state => ({
    key: "app",
    value: JSON.stringify(state),
  }));
  return {
    DOM: view(state$),
    HTTP: youTubeVideo.request$,
    storage: storage$
  };
}

Cycle.run(main, {
  DOM: makeDOMDriver("#root"),
  HTTP: makeHTTPDriver(),
  storage: storageDriver
});
