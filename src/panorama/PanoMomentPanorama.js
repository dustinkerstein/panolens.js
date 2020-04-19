import { Panorama } from './Panorama';
import { PanoMoments } from '../loaders/PanoMoments.min';
import * as THREE from 'three';

/**
 * @classdesc PanoMomentPanorama based panorama
 * @constructor
 * @param {object, bool} PanoMoments identifier and force reload option
 */
var myRadius = 3000; // Major hack for the render depth glitch mentioned below

function PanoMomentPanorama ( _identifier, _forceReload) {

    myRadius = myRadius - 5;
    var radius = myRadius; // There are some weird visual artifacts in the sphere mesh when using the 6000 radius (or values close to that) when there are other PanoMoments / 360 Photos loaded in the viewer.
    // This doesn't entirely fix it either as it seems to still show up during fadeIn/fadeOut. This glitch only shows up when manually setting the mesh rotation in animate() in the viewer.
    // Setting renderer.sortObjects = false fixes this with radius at 6000, but is still broken during the fading transition. For other reasons, there are conflicts with the fading transition (see my notes in animate()) so we'll need to figure out a plan.
    // The myRadius = myRadius - 5 is working for now... but damn that's ugly.
    const geometry = new THREE.SphereBufferGeometry( radius, 60, 40 );
    this.Material = new THREE.MeshBasicMaterial( { opacity: 0, transparent: true } );
       
    Panorama.call( this, geometry, this.Material );

    this.reload = false;
    this.forceReload = _forceReload !== undefined ? _forceReload : false; // Some use-cases won't require that the PanoMoment is disposed/re-loaded on enter/leave
    this.radius = radius;
    this.identifier = _identifier;
    this.isReady = false;

    this.addEventListener( 'panolens-camera', this.onPanolensCamera.bind( this ) );
    this.addEventListener( 'panolens-orbitcontrols', this.onPanolensOrbitControls.bind( this ) );

}

PanoMomentPanorama.prototype = Object.assign( Object.create( Panorama.prototype ), {

    constructor: PanoMomentPanorama,

    /**
     * When camera reference dispatched
     * @param {THREE.Camera} camera 
     */
    onPanolensCamera: function( { camera } ) {
        this.camera = camera;
    },

    /**
     * When OrbitControls reference dispatched
     * @param {THREE.Camera} camera 
     */
    onPanolensOrbitControls: function( { OrbitControls } ) {
        this.OrbitControls = OrbitControls;
    },

    load: function () {
        this.Texture = new THREE.Texture();   
        this.updateTexture( this.Texture );
        this.PanoMoment = new PanoMoments(this.identifier, this.renderCallback.bind( this ), this.readyCallback.bind( this ), this.loadedCallback.bind( this ));
        this.dispatchEvent( { type: 'panoMomentLoad' } );
        this.onLoad();
        console.log("PanoMoment Initialized.");
    },

    /**
     * On Panolens update callback
     */
    updateCallback: function() {
        if (this.momentData) { 
            var yaw = THREE.Math.radToDeg(this.camera.rotation.y) + 180; // Find the current viewer Yaw
            if (this.momentData.clockwise) { 
                yaw = (-yaw + 90) % 360; 
            } else {
                yaw = (yaw + 90) % 360; // This needs to be tested on counter clockwise PanoMoments. Haven't done that yet.
            }
            this.setPanoMomentYaw(yaw); // Pass the Yaw to PanoMomentPanorama via event
        }
    },

    renderCallback: function (video, momentData) {
        if (!this.momentData) {
            this.momentData = momentData;
            this.OrbitControls.panorama = this;
            this.OrbitControls.AzimuthAngleLimits();
            this.camera.position.copy( this.position );
            this.camera.position.z += 1;
            this.OrbitControls.rotateLeft( THREE.Math.degToRad(this.momentData.start_frame + 180) ); // Needed a way to specify a starting viewing angle. Out of the box, OrbitControls doesn't provide this... I'm sure there's some other way to do this though.
            this.rotation.y = THREE.Math.degToRad(this.momentData.max_horizontal_fov - 90); // Fix for start alignment but this seems to cause a weird visual glitch on PanoMoment.html (but strangely not PanoMoment.html)
            this.Texture = new THREE.Texture(video);
            this.Texture.minFilter = this.Texture.magFilter = THREE.LinearFilter;
            this.Texture.generateMipmaps = false;
            this.Texture.format = THREE.RGBFormat;
            this.Texture.needsUpdate = true;
            console.log("PanoMoment Start Frame Decoded.");
        }
    },

    readyCallback: function (video, momentData) {
        this.isReady = true;
        this.dispatchEvent( { type: 'panoMomentReady' } );
        console.log("PanoMoment Ready for Rendering.");
    },

    loadedCallback: function (video, momentData) {
        console.log("PanoMoment Download Complete.");
    },

    /**
     * Set PanoMoment yaw
     * @memberOf PanoMomentPanorama
     * @instance
     * @param {object} event - Event contains float. 0.0 to 360.0
     */

    setPanoMomentYaw: function (yaw) {

        if (this.momentData) {
            const yawDerivedFrame =  (yaw / 360) * this.PanoMoment.FrameCount;
            this.PanoMoment.render(yawDerivedFrame);
            this.Material.map = this.Texture; // Appears to be needed even though it shouldn't be...
            if (this.PanoMoment.textureReady) {
                this.Texture.needsUpdate = true;
            }
        }

    },

     /**
     * onEnter
     * @memberOf PanoMomentPanorama
     * @instance
     */
    onEnter: function () {

        // Add update callback
        this.dispatchEvent( { 
            type: 'panolens-viewer-handler', 
            method: 'addUpdateCallback', 
            data: this.updateCallback.bind(this)
        });

        if (this.reload && this.forceReload) {
            this.reload = false;
            this.load();
        }

        Panorama.prototype.onEnter.call( this );

    },

    /**
     * onLeave
     * @memberOf PanoMomentPanorama
     * @instance
     */
    onLeave: function () {

        // Remove update callback
        this.dispatchEvent( { 
            type: 'panolens-viewer-handler', 
            method: 'removeUpdateCallback', 
            data: this.updateCallback.bind(this)
        });

        if (this.forceReload) {
            this.isReady = false;
            this.reload = true;
            this.PanoMoment.dispose(); // This currently doesn't stop an ongoing download which is a bit of an issue... Maybe for later though.
            this.PanoMoment = null; 
            this.momentData = null;
        }

        Panorama.prototype.onLeave.call( this );

    },

    /**
     * Reset
     * @memberOf PanoMomentPanorama
     * @instance
     */
    reset: function () {

        Panorama.prototype.reset.call( this );

    },

    /**
     * Dispose
     * @memberOf PanoMomentPanorama
     * @instance
     */
    dispose: function () {

        const { material: { map } } = this;

        if ( map ) { map.dispose(); }

        Panorama.prototype.dispose.call( this );

    }

} );

export { PanoMomentPanorama };