/**
 * Reddit API endpoints configuration
 */

export const REDDIT_BASE_URL = "https://oauth.reddit.com";
export const REDDIT_WWW_URL = "https://www.reddit.com";

/**
 * Reddit API endpoints
 */
export const RedditEndpoints = {
  // Subreddit endpoints
  subreddit: {
    about: (subreddit: string) => `/r/${subreddit}/about`,
    hot: (subreddit: string) => `/r/${subreddit}/hot`,
    new: (subreddit: string) => `/r/${subreddit}/new`,
    top: (subreddit: string) => `/r/${subreddit}/top`,
    rising: (subreddit: string) => `/r/${subreddit}/rising`,
    controversial: (subreddit: string) => `/r/${subreddit}/controversial`,
    search: (subreddit: string) => `/r/${subreddit}/search`,
    moderators: (subreddit: string) => `/r/${subreddit}/about/moderators`,
    rules: (subreddit: string) => `/r/${subreddit}/about/rules`,
  },

  // Post/Submission endpoints
  post: {
    byId: (id: string) => `/api/info?id=t3_${id}`,
    comments: (subreddit: string, postId: string) =>
      `/r/${subreddit}/comments/${postId}`,
    submit: () => `/api/submit`,
    vote: () => `/api/vote`,
    save: () => `/api/save`,
    unsave: () => `/api/unsave`,
    hide: () => `/api/hide`,
    unhide: () => `/api/unhide`,
    report: () => `/api/report`,
  },

  // Comment endpoints
  comment: {
    submit: () => `/api/comment`,
    edit: () => `/api/editusertext`,
    delete: () => `/api/del`,
    moreChildren: () => `/api/morechildren`,
  },

  // User endpoints
  user: {
    about: (username: string) => `/user/${username}/about`,
    overview: (username: string) => `/user/${username}/overview`,
    submitted: (username: string) => `/user/${username}/submitted`,
    comments: (username: string) => `/user/${username}/comments`,
    upvoted: (username: string) => `/user/${username}/upvoted`,
    downvoted: (username: string) => `/user/${username}/downvoted`,
    hidden: (username: string) => `/user/${username}/hidden`,
    saved: (username: string) => `/user/${username}/saved`,
    gilded: (username: string) => `/user/${username}/gilded`,
    me: () => `/api/v1/me`,
    prefs: () => `/api/v1/me/prefs`,
    trophies: () => `/api/v1/me/trophies`,
    karma: () => `/api/v1/me/karma`,
    friends: () => `/api/v1/me/friends`,
    blocked: () => `/prefs/blocked`,
  },

  // Search endpoints
  search: {
    reddit: () => `/search`,
    subreddits: () => `/subreddits/search`,
    users: () => `/users/search`,
  },

  // Listing endpoints
  listing: {
    hot: () => `/hot`,
    new: () => `/new`,
    top: () => `/top`,
    rising: () => `/rising`,
    controversial: () => `/controversial`,
    best: () => `/best`,
    random: () => `/random`,
  },

  // Message endpoints
  message: {
    inbox: () => `/message/inbox`,
    unread: () => `/message/unread`,
    sent: () => `/message/sent`,
    compose: () => `/api/compose`,
    markRead: () => `/api/read_message`,
    markUnread: () => `/api/unread_message`,
  },

  // Moderation endpoints
  moderation: {
    modqueue: (subreddit?: string) =>
      subreddit ? `/r/${subreddit}/about/modqueue` : `/r/mod/about/modqueue`,
    reports: (subreddit?: string) =>
      subreddit ? `/r/${subreddit}/about/reports` : `/r/mod/about/reports`,
    spam: (subreddit?: string) =>
      subreddit ? `/r/${subreddit}/about/spam` : `/r/mod/about/spam`,
    edited: (subreddit?: string) =>
      subreddit ? `/r/${subreddit}/about/edited` : `/r/mod/about/edited`,
    unmoderated: (subreddit?: string) =>
      subreddit
        ? `/r/${subreddit}/about/unmoderated`
        : `/r/mod/about/unmoderated`,
    approve: () => `/api/approve`,
    remove: () => `/api/remove`,
    distinguish: () => `/api/distinguish`,
  },

  // Wiki endpoints
  wiki: {
    pages: (subreddit: string) => `/r/${subreddit}/wiki/pages`,
    page: (subreddit: string, page: string) => `/r/${subreddit}/wiki/${page}`,
    revisions: (subreddit: string, page?: string) =>
      page
        ? `/r/${subreddit}/wiki/revisions/${page}`
        : `/r/${subreddit}/wiki/revisions`,
    edit: (subreddit: string) => `/r/${subreddit}/api/wiki/edit`,
  },

  // Flair endpoints
  flair: {
    list: (subreddit: string) => `/r/${subreddit}/api/user_flair_v2`,
    templates: (subreddit: string) => `/r/${subreddit}/api/user_flair`,
    select: (subreddit: string) => `/r/${subreddit}/api/selectflair`,
    linkTemplates: (subreddit: string) => `/r/${subreddit}/api/link_flair`,
    setLink: (subreddit: string) => `/r/${subreddit}/api/flair`,
  },

  // Multi endpoints (custom feeds)
  multi: {
    mine: () => `/api/multi/mine`,
    get: (username: string, multiname: string) =>
      `/api/multi/${username}/${multiname}`,
    create: () => `/api/multi`,
    update: (multipath: string) => `/api/multi/${multipath}`,
    delete: (multipath: string) => `/api/multi/${multipath}`,
  },

  // Live thread endpoints
  live: {
    thread: (threadId: string) => `/live/${threadId}`,
    about: (threadId: string) => `/live/${threadId}/about`,
    updates: (threadId: string) => `/live/${threadId}.json`,
    contributors: (threadId: string) => `/live/${threadId}/contributors`,
    discussions: (threadId: string) => `/live/${threadId}/discussions`,
  },
};

/**
 * Query parameter builders
 */
export const QueryParams = {
  /**
   * Build listing query parameters
   */
  listing: (options?: {
    limit?: number;
    after?: string;
    before?: string;
    count?: number;
    show?: "all";
    t?: "hour" | "day" | "week" | "month" | "year" | "all";
    sort?: "hot" | "new" | "top" | "rising" | "controversial";
  }) => {
    const params = new URLSearchParams();

    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.after) params.append("after", options.after);
    if (options?.before) params.append("before", options.before);
    if (options?.count) params.append("count", options.count.toString());
    if (options?.show) params.append("show", options.show);
    if (options?.t) params.append("t", options.t);
    if (options?.sort) params.append("sort", options.sort);

    return params;
  },

  /**
   * Build search query parameters
   */
  search: (options: {
    q: string;
    sort?: "relevance" | "hot" | "top" | "new" | "comments";
    t?: "hour" | "day" | "week" | "month" | "year" | "all";
    type?: "link" | "self" | "image" | "video" | "videogif" | "gallery";
    limit?: number;
    after?: string;
    before?: string;
    restrict_sr?: boolean;
    include_over_18?: boolean;
  }) => {
    const params = new URLSearchParams();

    params.append("q", options.q);
    if (options.sort) params.append("sort", options.sort);
    if (options.t) params.append("t", options.t);
    if (options.type) params.append("type", options.type);
    if (options.limit) params.append("limit", options.limit.toString());
    if (options.after) params.append("after", options.after);
    if (options.before) params.append("before", options.before);
    if (options.restrict_sr !== undefined) {
      params.append("restrict_sr", options.restrict_sr.toString());
    }
    if (options.include_over_18 !== undefined) {
      params.append("include_over_18", options.include_over_18.toString());
    }

    return params;
  },

  /**
   * Build comment tree parameters
   */
  comments: (options?: {
    limit?: number;
    depth?: number;
    sort?:
      | "confidence"
      | "top"
      | "new"
      | "controversial"
      | "old"
      | "random"
      | "qa"
      | "live";
    showedits?: boolean;
    showmore?: boolean;
    threaded?: boolean;
    truncate?: number;
  }) => {
    const params = new URLSearchParams();

    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.depth) params.append("depth", options.depth.toString());
    if (options?.sort) params.append("sort", options.sort);
    if (options?.showedits !== undefined) {
      params.append("showedits", options.showedits.toString());
    }
    if (options?.showmore !== undefined) {
      params.append("showmore", options.showmore.toString());
    }
    if (options?.threaded !== undefined) {
      params.append("threaded", options.threaded.toString());
    }
    if (options?.truncate)
      params.append("truncate", options.truncate.toString());

    return params;
  },
};

/**
 * Helper to build full URL
 */
export function buildUrl(
  endpoint: string,
  params?: URLSearchParams,
  baseUrl: string = REDDIT_BASE_URL,
): string {
  const url = `${baseUrl}${endpoint}`;
  if (params && params.toString()) {
    return `${url}?${params.toString()}`;
  }
  return url;
}
