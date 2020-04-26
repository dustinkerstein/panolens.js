import { Panorama } from './Panorama';
import { PanoMoments } from '../loaders/PanoMoments';
import * as THREE from 'three';

const PANOMOMENT = {
    NONE: 'panomoments.none',
    FIRST_FRAME_DECODED: 'panomoments.first_frame_decoded',
    READY: 'panomoments.ready',
    COMPLETED: 'panomoments.completed',
};

/**
 * PanoMoments Panorama
 * @param {object} identifier PanoMoment identifier
 */
function PanoMomentPanorama ( identifier, options = {} ) {


    this.options = Object.assign( {
        plane: false
    }, options );

    Panorama.call( this );

    // PanoMoments
    this.identifier = identifier;
    this.PanoMoments = null;
    this.momentData = null;
    this.status = PANOMOMENT.NONE;

    // Panolens
    this.camera = null;
    this.controls = null;
    this.defaults = {};

    // Setup Dispatcher
    this.setupDispatcher();

    // Event Bindings
    this.viewerUpdateCallback = () => this.updateCallback();
    this.viewerResetControlLimits = () => this.resetControlLimits( false );
    this.updateMomentum = ( up, left ) => this.momentumFunction( up, left );

    // Event Listeners
    this.addEventListener( 'panolens-camera', data => this.onPanolensCamera( data ) );
    this.addEventListener( 'panolens-controls', data => this.onPanolensControls( data ) );
    this.addEventListener( 'enter-fade-start', () => this.enter() );
    this.addEventListener( 'leave-complete', () => this.leave() );
    this.addEventListener( 'load-start', () => this.disableControl() );
    this.addEventListener( PANOMOMENT.READY, () => this.enableControl() );

}

PanoMomentPanorama.prototype = Object.assign( Object.create( Panorama.prototype ), {

    constructor: PanoMomentPanorama,

    /**
     * When camera reference dispatched
     * @param {THREE.Camera} camera 
     */
    onPanolensCamera: function( { camera } ) {

        Object.assign( this.defaults, { fov: camera.fov } );

        this.camera = camera;

    },

    /**
     * When control references dispatched
     * @param {THREE.Object[]} controls 
     */
    onPanolensControls: function( { controls } ) {
        
        this.controls = controls;

    },

    /**
     * Intercept default dispatcher
     */
    setupDispatcher: function() {

        const dispatch = this.dispatchEvent.bind( this );
        const values = Object.values( PANOMOMENT );
  
        this.dispatchEvent = function( event ) {
 
            if ( values.includes( event.type ) ) {

                this.status = event.type;

            }

            dispatch( event );

        };

    },

    /**
     * Enable Control
     */
    enableControl: function() {

        const [ OrbitControls ] = this.controls;

        OrbitControls.enabled = true;

    },

    /**
     * Disable Control
     */
    disableControl: function() {

        const [ OrbitControls ] = this.controls;

        OrbitControls.enabled = false;

    },

    /**
     * Attch UI Event Listener to Container
     * @param {boolean} attach 
     */
    attachFOVListener: function( attach = true ) {

        const [ OrbitControls ] = this.controls;

        if ( attach ) {

            OrbitControls.addEventListener( 'fov', this.viewerResetControlLimits );

        } else {

            OrbitControls.removeEventListener( 'fov', this.viewerResetControlLimits );

        }
        
    },

    /**
     * Reset Polar Angle and FOV Limits
     * @param {boolean} reset
     */
    resetControlLimits: function( reset = false ) {

        const { momentData } = this;

        if ( !momentData ) return;

        this.resetAzimuthAngleLimits( reset );
        this.resetFOVLimits( reset );

    },

    /**
     * Update intial heading based on moment data
     */
    updateHeading: function() {

        if ( !this.momentData ) return;

        const { momentData: { start_frame, max_horizontal_fov } } = this;

        // reset center to initial lookat
        this.dispatchEvent( { type: 'panolens-viewer-handler', method: 'setControlCenter' } );

        // rotate to initial frame center
        const angle = (start_frame + 180) / 180 * Math.PI;
        this.dispatchEvent( { type: 'panolens-viewer-handler', method: 'rotateControlLeft', data: angle } );

        // uv offset
        if (!this.options.plane) {
            this.material.uniforms.offset.value.x = (max_horizontal_fov / 360 + .25) % 1;
        }

        // control update
        this.resetControlLimits( false );

    },

    /**
     * Load Pano Moment Panorama
     */
    load: function () {

        Panorama.prototype.load.call( this, false );
        
        const { identifier, renderCallback, readyCallback, loadedCallback } = this;

        this.PanoMoments = new PanoMoments(
            identifier, 
            renderCallback.bind( this ), 
            readyCallback.bind( this ), 
            loadedCallback.bind( this )
        );

    },

    /**
     * On Panolens update callback
     */
    updateCallback: function() {

        const { camera, momentData, status } = this;

        if( (status !== PANOMOMENT.FIRST_FRAME_DECODED && status !== PANOMOMENT.READY && status !== PANOMOMENT.COMPLETED) || !momentData ) return;
        
        const rotation = THREE.Math.radToDeg(camera.rotation.y) + 180;
        const yaw = (rotation * (momentData.clockwise ? -1.0 : 1.0) + 90) % 360;

        // textureReady() must be called before render() 
        if (this.options.plane && this.PanoMoments.textureReady()) {
            this.material.map.needsUpdate = true;
        } else if (this.PanoMoments.textureReady()) {
            this.getTexture().needsUpdate = true;
        }

        this.setPanoMomentYaw( yaw );
        
    },

    /**
     * On Pano Moment Render Callback
     */
    renderCallback: function (video, momentData) {

        if ( !this.momentData ) {

            this.momentData = momentData;

            if (this.options.plane) {
                this.camera.add(this);
                this.position.set(0,0,-2);
                var windowAspectRatio = window.innerWidth / window.innerHeight;
                var videoAspectRatio = this.momentData.aspect_ratio ? this.momentData.aspect_ratio : 1.7777777; // Shouldn't really fall back to 16/9 but it's okay for now
                var distanceToPlane = Math.abs(this.position.z);
                var limit;
                if (videoAspectRatio < windowAspectRatio) {
                    limit = (Math.tan (THREE.Math.degToRad(this.camera.fov * 0.5)) * distanceToPlane * 2.0) * videoAspectRatio; 
                } else {
                    limit = (Math.tan (THREE.Math.degToRad(this.camera.fov * 0.5)) * distanceToPlane * 2.0) * windowAspectRatio 
                }
                var calcScale = new THREE.Vector3 (limit, limit / videoAspectRatio, 1);
                this.scale.set(calcScale.x,calcScale.y,1);
            }

            const texture = new THREE.Texture( video );
            texture.minFilter = texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = false;
            texture.format = THREE.RGBFormat; 

            if (this.options.plane) {
                this.material.map = texture;
                texture.needsUpdate = true;
            } else {
                this.updateTexture( texture );   
            }

            this.dispatchEvent( { type: PANOMOMENT.FIRST_FRAME_DECODED } );
            console.log('PanoMoments First Frame Decoded');

            Panorama.prototype.onLoad.call( this );

        }
    },

    /**
     * On Pano Moment Ready Callback
     */
    readyCallback: function () {

        this.dispatchEvent( { type: PANOMOMENT.READY } );
        console.log('PanoMoment Ready');
    },

    /**
     * On Pano Moment Loaded Callback
     */
    loadedCallback: function () {

        this.dispatchEvent( { type: PANOMOMENT.COMPLETED } );
        console.log('PanoMoment Download Completed');

    },

    /**
     * Reset Polar Angle Limit by momentData or default
     * @param {boolean} reset 
     */
    resetAzimuthAngleLimits: function( reset = false ) {

        const { controls: [ OrbitControls ], 
            momentData: { contains_parallax, min_vertical_fov } , defaults, camera } = this;

        if ( !contains_parallax ) return;

        const delta = THREE.Math.degToRad( ( 0.95 * min_vertical_fov - camera.fov ) / 2 );
        const angles = {
            minPolarAngle: Math.PI / 2 - delta,
            maxPolarAngle: Math.PI / 2 + delta
        };

        Object.assign( OrbitControls, reset ? defaults : angles );

    },

    /**
     * Calculate FOV limit
     * @param {number} fov 
     * @param {boolean} horizontal 
     */
    calculateFOV: function( fov, horizontal ) {

        const { camera: { aspect } } = this;
        const factor = horizontal ? aspect : ( 1 / aspect );

        return 2 * Math.atan( Math.tan( fov * Math.PI / 360 ) * factor ) / Math.PI * 180;

    },

    /**
     * Set FOV Limit by momentData or default
     * @param {boolean} reset 
     */
    resetFOVLimits: function ( reset = false ) {

        const { momentData, camera, controls: [ OrbitControls ], defaults: { fov } } = this;
        const fovH = this.calculateFOV( camera.fov, true ) ;

        if ( fovH > ( momentData.min_horizontal_fov * .95 ) ) {

            camera.fov = this.calculateFOV( momentData.min_horizontal_fov * .95, false );
        
        } else if ( fovH < OrbitControls.minFov ) {

            camera.fov = this.calculateFOV( OrbitControls.minFov, false );

        }

        camera.fov = reset ? fov : camera.fov;
        camera.updateProjectionMatrix();

    },

    /**
     * Set PanoMoment yaw
     * @memberOf PanoMomentPanorama
     * @param {number} yaw - yaw value from 0 to 360 in degree
     */
    setPanoMomentYaw: function (yaw) {

        const { status, momentData, PanoMoments: { render, FrameCount } } = this;

        if( (status !== PANOMOMENT.READY && status !== PANOMOMENT.COMPLETED) || !momentData ) return;

        render((yaw / 360) * FrameCount);

    },

    /**
     * Enter Panorama
     */
    enter: function() {

        this.updateHeading();
        this.attachFOVListener( true );
        this.resetControlLimits( false );

        // Add update callback
        this.dispatchEvent( { 
            type: 'panolens-viewer-handler', 
            method: 'addUpdateCallback', 
            data: this.viewerUpdateCallback
        });

    },

    /**
     * Leave Panorama
     */
    leave: function() {

        this.attachFOVListener( false );
        this.resetControlLimits( true );

        // Remove update callback
        this.dispatchEvent( { 
            type: 'panolens-viewer-handler', 
            method: 'removeUpdateCallback', 
            data: this.viewerUpdateCallback
        });

    },

    /**
     * Dispose Panorama
     */
    dispose: function() {

        this.leave();

        // this.PanoMoments.dispose();
        this.PanoMoments = null;
        this.momentData = null;

        Panorama.prototype.dispose.call( this );

    }

} );

export { PanoMomentPanorama, PANOMOMENT };