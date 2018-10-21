/**
 * External dependencies
 */
import { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import debugFactory from 'debug';
import PropTypes from 'prop-types';
import shallowEqual from 'shallowequal';

/**
 * Internal dependencies
 */
import { isRequestingPostsForQuery, isRequestingPost } from './selectors';
import { requestPosts, requestPost } from './state';

const debug = debugFactory( 'query:post' );

class WPPostQuery extends Component {
	componentWillMount() {
		this.request( this.props );
	}

	componentWillReceiveProps( nextProps ) {
		if (
			this.props.postSlug === nextProps.postSlug &&
			shallowEqual( this.props.query, nextProps.query )
		) {
			return;
		}

		this.request( nextProps );
	}

	request( props ) {
		const single = !! props.postSlug;

		if ( ! single && ! props.requestingPosts ) {
			debug( `Request post list using query ${ props.query }` );
			props.requestPosts( props.query );
		}

		if ( single && ! props.requestingPost ) {
			debug( `Request single post ${ props.postSlug }` );
			props.requestPost( props.postSlug );
		}
	}

	render() {
		return null;
	}
}

WPPostQuery.propTypes = {
	postSlug: PropTypes.string,
	query: PropTypes.object,
	requestingPosts: PropTypes.bool,
	requestPosts: PropTypes.func,
};

WPPostQuery.defaultProps = {
	requestPosts: () => {},
};

export default connect(
	( state, ownProps ) => {
		const { postSlug, query } = ownProps;
		return {
			requestingPost: isRequestingPost( state, postSlug ),
			requestingPosts: isRequestingPostsForQuery( state, query ),
		};
	},
	dispatch => {
		return bindActionCreators(
			{
				requestPosts,
				requestPost,
			},
			dispatch,
		);
	},
)( WPPostQuery );
