import React, { Component } from 'react';
import PropTypes from 'prop-types';
import MapView from 'react-native-maps';
import isEqual from 'lodash.isequal';
import { decode } from '@mapbox/polyline';

class MapViewDirections extends Component {
	constructor(props) {
		super(props);
		this.state = {
			coordinates: null,
			distance: null,
			duration: null,
		};
	}
	componentDidMount() {
		this._mounted = true;
		this.fetchAndRenderRoute(this.props);
	}
	componentWillUnmount() {
		this._mounted = false;
	}
	componentWillReceiveProps(nextProps) {
		if (!isEqual(nextProps.origin, this.props.origin) || !isEqual(nextProps.destination, this.props.destination) || !isEqual(nextProps.waypoints, this.props.waypoints) || !isEqual(nextProps.mode, this.props.mode)) {
			if (nextProps.resetOnChange === false) {
				this.fetchAndRenderRoute(nextProps);
			} else {
				this.resetState(() => {
					this.fetchAndRenderRoute(nextProps);
				});
			}
		}
	}

	resetState = (cb = null) => {
		this._mounted && this.setState({
			coordinates: null,
			distance: null,
			duration: null,
		}, cb);
	}

	fetchAndRenderRoute = (props) => {

		let {
			origin,
			destination,
			waypoints,
			apikey,
			onStart,
			onReady,
			onError,
			mode = 'DRIVING',
			language = 'en',
			optimizeWaypoints,
			directionsServiceBaseUrl = 'https://maps.googleapis.com/maps/api/directions/json',
			region,
		} = props;

		if (!origin || !destination) {
			return;
		}

		if (origin.latitude && origin.longitude) {
			origin = `${origin.latitude},${origin.longitude}`;
		}

		if (destination.latitude && destination.longitude) {
			destination = `${destination.latitude},${destination.longitude}`;
		}

		if (!waypoints || !waypoints.length) {
			waypoints = '';
		} else {
			waypoints = waypoints
				.map(waypoint => (waypoint.latitude && waypoint.longitude) ? `${waypoint.latitude},${waypoint.longitude}` : waypoint)
				.join('|');
		}
		if (optimizeWaypoints) {
			waypoints = `optimize:true|${waypoints}`;
		}

		onStart && onStart({
			origin,
			destination,
			waypoints: waypoints ? waypoints.split('|') : [],
		});

		this.fetchRoute(directionsServiceBaseUrl, origin, waypoints, destination, apikey, mode, language, region)
			.then(result => {
				if (!this._mounted) return;
				this.setState(result);
				console.log(JSON.stringify(result));
				onReady && onReady(result);
			})
			.catch(errorMessage => {
				this.resetState();
				console.warn(`MapViewDirections Error: ${errorMessage}`); // eslint-disable-line no-console
				onError && onError(errorMessage);
			});
	}

	fetchRoute(directionsServiceBaseUrl, origin, waypoints, destination, apikey, mode, language, region) {

		// Define the URL to call. Only add default parameters to the URL if it's a string.
		let url = directionsServiceBaseUrl;
		if (typeof (directionsServiceBaseUrl) === 'string') {
			url += `?origin=${origin}&waypoints=${waypoints}&destination=${destination}&key=${apikey}&mode=${mode.toLowerCase()}&language=${language}&region=${region}`;
		}

		return fetch(url)
			.then(response => response.json())
			.then(json => {
				if (json.status !== 'OK') {
					const errorMessage = json.error_message || 'Unknown error';
					return Promise.reject(errorMessage);
				}
				if (json.routes.length) {
					const route = json.routes[0];
					const { legs } = route;
					const coors = [];
					const waypoints = [];
					legs.forEach(({ steps }) => {
						steps.forEach(({ polyline, distance, end_location }) => {
							const wayPointObj = {
								distance,
								end_location
							};
							const latlngs = decode(polyline.points)
								.map(point => ({ latitude: point[0], longitude: point[1] }));    
							latlngs.forEach(latlng => {
								coors.push(latlng);
							});
							waypoints.push(wayPointObj);
						});
					});
					return Promise.resolve({
						distance: route.legs.reduce((carry, curr) => {
							return carry + curr.distance.value;
						}, 0) / 1000,
						duration: route.legs.reduce((carry, curr) => {
							return carry + curr.duration.value;
						}, 0) / 60,
						coordinates: coors,
						waypoints,
						fare: route.fare,
					});

				} else {
					return Promise.reject();
				}
			})
			.catch(err => {
				console.warn(
					'react-native-maps-directions Error on GMAPS route request',
					err
				);
			});
	}

	render() {
		if (!this.state.coordinates) {
			return null;
		}

		const {
			origin, // eslint-disable-line no-unused-vars
			waypoints, // eslint-disable-line no-unused-vars
			destination, // eslint-disable-line no-unused-vars
			apikey, // eslint-disable-line no-unused-vars
			onReady, // eslint-disable-line no-unused-vars
			onError, // eslint-disable-line no-unused-vars
			mode, // eslint-disable-line no-unused-vars
			language, // eslint-disable-line no-unused-vars
			region,
			...props
		} = this.props;

		return (
			<MapView.Polyline coordinates={this.state.coordinates} {...props} />
		);
	}

}

MapViewDirections.propTypes = {
	origin: PropTypes.oneOfType([
		PropTypes.string,
		PropTypes.shape({
			latitude: PropTypes.number.isRequired,
			longitude: PropTypes.number.isRequired,
		}),
	]),
	waypoints: PropTypes.arrayOf(
		PropTypes.oneOfType([
			PropTypes.string,
			PropTypes.shape({
				latitude: PropTypes.number.isRequired,
				longitude: PropTypes.number.isRequired,
			}),
		]),
	),
	destination: PropTypes.oneOfType([
		PropTypes.string,
		PropTypes.shape({
			latitude: PropTypes.number.isRequired,
			longitude: PropTypes.number.isRequired,
		}),
	]),
	apikey: PropTypes.string.isRequired,
	onStart: PropTypes.func,
	onReady: PropTypes.func,
	onError: PropTypes.func,
	mode: PropTypes.oneOf(['DRIVING', 'BICYCLING', 'TRANSIT', 'WALKING']),
	language: PropTypes.string,
	resetOnChange: PropTypes.bool,
	optimizeWaypoints: PropTypes.bool,
	directionsServiceBaseUrl: PropTypes.string,
	region: PropTypes.string,
};

export default MapViewDirections;
