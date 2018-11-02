/*global SiteSettings */
/**
 * External dependencies
 */
import { combineReducers } from 'redux';
import { keyBy, reduce } from 'lodash';
import qs from 'qs';
import API from 'wordpress-rest-api-oauth-1';
const api = new API( {
	url: SiteSettings.endpoint,
} );

import {
	getSerializedPostsQuery,
} from './utils';

/**
 * Post actions
 */
export const POST_REQUEST = 'wordpress-redux/post/REQUEST';
export const POST_REQUEST_SUCCESS = 'wordpress-redux/post/REQUEST_SUCCESS';
export const POST_REQUEST_FAILURE = 'wordpress-redux/post/REQUEST_FAILURE';
export const POSTS_RECEIVE = 'wordpress-redux/posts/RECEIVE';
export const POSTS_REQUEST = 'wordpress-redux/posts/REQUEST';
export const POSTS_REQUEST_SUCCESS = 'wordpress-redux/posts/REQUEST_SUCCESS';
export const POSTS_REQUEST_FAILURE = 'wordpress-redux/posts/REQUEST_FAILURE';

/**
 * Tracks all known post objects, indexed by post global ID.
 *
 * @param  {Object} state  Current state
 * @param  {Object} action Action payload
 * @return {Object}        Updated state
 */
export function items( state = {}, action ) {
	switch ( action.type ) {
		case POSTS_RECEIVE:
			const posts = keyBy( action.posts, 'id' );
			return Object.assign( {}, state, posts );
		default:
			return state;
	}
}

/**
 * Returns the updated post requests state after an action has been
 * dispatched. The state reflects a mapping of post ID to a
 * boolean reflecting whether a request for the post is in progress.
 *
 * @param  {Object} state  Current state
 * @param  {Object} action Action payload
 * @return {Object}        Updated state
 */
export function requests( state = {}, action ) {
	switch ( action.type ) {
		case POST_REQUEST:
		case POST_REQUEST_SUCCESS:
		case POST_REQUEST_FAILURE:
			return Object.assign( {}, state, { [ action.postSlug ]: POST_REQUEST === action.type } );
		default:
			return state;
	}
}

/**
 * Returns the updated post query requesting state after an action has been
 * dispatched. The state reflects a mapping of serialized query to whether a
 * network request is in-progress for that query.
 *
 * @param  {Object} state  Current state
 * @param  {Object} action Action payload
 * @return {Object}        Updated state
 */
export function queryRequests( state = {}, action ) {
	switch ( action.type ) {
		case POSTS_REQUEST:
		case POSTS_REQUEST_SUCCESS:
		case POSTS_REQUEST_FAILURE:
			const serializedQuery = getSerializedPostsQuery( action.query );
			return Object.assign( {}, state, {
				[ serializedQuery ]: POSTS_REQUEST === action.type,
			} );

		default:
			return state;
	}
}

/**
 * Tracks the page length for a given query.
 * @todo Bring in the "without paged" util, to reduce duplication
 *
 * @param  {Object} state  Current state
 * @param  {Object} action Action payload
 * @return {Object}        Updated state
 */
export function totalPages( state = {}, action ) {
	switch ( action.type ) {
		case POSTS_REQUEST_SUCCESS:
			const serializedQuery = getSerializedPostsQuery( action.query );
			return Object.assign( {}, state, {
				[ serializedQuery ]: action.totalPages,
			} );
		default:
			return state;
	}
}

/**
 * Returns the updated post query state after an action has been dispatched.
 * The state reflects a mapping of serialized query key to an array of post
 * global IDs for the query, if a query response was successfully received.
 *
 * @param  {Object} state  Current state
 * @param  {Object} action Action payload
 * @return {Object}        Updated state
 */
export function queries( state = {}, action ) {
	switch ( action.type ) {
		case POSTS_REQUEST_SUCCESS:
			const serializedQuery = getSerializedPostsQuery( action.query );
			return Object.assign( {}, state, {
				[ serializedQuery ]: action.posts.map( ( post ) => post.id ),
			} );
		default:
			return state;
	}
}

/**
 * Tracks the slug->ID mapping for posts
 *
 * @param  {Object} state  Current state
 * @param  {Object} action Action payload
 * @return {Object}        Updated state
 */
export function slugs( state = {}, action ) {
	switch ( action.type ) {
		case POST_REQUEST_SUCCESS:
			return Object.assign( {}, state, {
				[ action.postSlug ]: action.postId,
			} );
		case POSTS_RECEIVE:
			const posts = reduce( action.posts, ( memo, p ) => {
				memo[ p.slug ] = p.id;
				return memo;
			}, {} );
			return Object.assign( {}, state, posts );
		default:
			return state;
	}
}

export default combineReducers( {
	items,
	requests,
	totalPages,
	queryRequests,
	queries,
	slugs,
} );

/**
 * Figures out the REST API URL for a given post type
 * @param  {string} postType the post type
 * @return {string}          A URL to make a REST request to
 */
function getURLForType(postType) {
	let url = '';
	switch (postType) {
		case 'post':
			url = '/wp/v2/posts';
			break;
		case 'page':
			url = '/wp/v2/pages';
			break;
		default:
			url = '/wp/v2/' + postType;
	}
	return url;
}

/**
 * Triggers a network request to fetch posts for the specified site and query.
 *
 * @param  {String}   query  Post query
 * @return {Function}        Action thunk
 */
export function requestPosts( query = {} ) {
	return ( dispatch ) => {
		const defaults = {
			post_type: 'post'
		}
		query = { ...defaults, ...query,  };
		dispatch( {
			type: POSTS_REQUEST,
			query,
		} );

		query._embed = true;

		const url = getURLForType( query.post_type );

		api.get( url, query ).then( posts => {
			dispatch( {
				type: POSTS_RECEIVE,
				posts,
			} );
			requestPageCount( url, query ).then( count => {
				dispatch( {
					type: POSTS_REQUEST_SUCCESS,
					query,
					totalPages: count,
					posts,
				} );
			} );
			return null;
		} ).catch( ( error ) => {
			dispatch( {
				type: POSTS_REQUEST_FAILURE,
				query,
				error,
			} );
		} );
	};
}

/**
 * Triggers a network request to fetch a specific post from a site.
 *
 * @param  {string}   postSlug  Post slug
 * @param  {string}   postType  Post type
 * @return {Function}           Action thunk
 */
export function requestPost( postSlug, postType = 'post' ) {
	return ( dispatch ) => {
		dispatch( {
			type: POST_REQUEST,
			postSlug,
		} );

		const query = {
			slug: postSlug,
			_embed: true,
		};

		const url = getURLForType( postType );

		api.get( url, query ).then( data => {
			const post = data[ 0 ];
			dispatch( {
				type: POSTS_RECEIVE,
				posts: [ post ],
			} );
			dispatch( {
				type: POST_REQUEST_SUCCESS,
				postId: post.id,
				postSlug,
			} );
			return null;
		} ).catch( ( error ) => {
			dispatch( {
				type: POST_REQUEST_FAILURE,
				postSlug,
				error,
			} );
		} );
	};
}

function requestPageCount( url, data = null ) {
	if ( url.indexOf( 'http' ) !== 0 ) {
		url = `${ api.config.url }wp-json${ url }`;
	}

	if ( data ) {
		// must be decoded before being passed to ouath
		url += `?${ decodeURIComponent( qs.stringify( data ) ) }`;
		data = null;
	}

	const headers = {
		Accept: 'application/json',
		'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
	};

	return fetch( url, {
		method: 'HEAD',
		headers: headers,
		mode: 'cors',
		body: null,
	} )
		.then( response => {
			return parseInt( response.headers.get( 'X-WP-TotalPages' ), 10 ) || 1;
		} );
}
