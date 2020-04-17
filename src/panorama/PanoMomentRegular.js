import { Panorama } from './Panorama';
import { PanoMoments } from '../loaders/PanoMoments.min';
import { BallSpinerLoader } from '../lib/spinners/BallSpinner';
import * as THREE from 'three';

/**
 * @classdesc PanoMomentRegular
 * @constructor
 * @param {object, bool} PanoMoments identifier and force reload option
 */
var myRadius = 3000; // Major hack for the render depth glitch mentioned below

function PanoMomentRegular ( _identifier, _forceReload) {

    myRadius = myRadius - 5;
    var radius = myRadius; // There are some weird visual artifacts in the sphere mesh when using the 6000 radius (or values close to that) when there are other PanoMoments / 360 Photos loaded in the viewer.
    // This doesn't entirely fix it either as it seems to still show up during fadeIn/fadeOut. This glitch only shows up when manually setting the mesh rotation in animate() in the viewer.
    // Setting renderer.sortObjects = false fixes this with radius at 6000, but is still broken during the fading transition. For other reasons, there are conflicts with the fading transition (see my notes in animate()) so we'll need to figure out a plan.
    // The myRadius = myRadius - 5 is working for now... but damn that's ugly.
    const geometry = new THREE.PlaneGeometry(1, 1);

    this.Material = new THREE.MeshBasicMaterial( { opacity: 0, transparent: true } );
       
    Panorama.call( this, geometry, this.Material );

    this.reload = false;
    this.forceReload = _forceReload !== undefined ? _forceReload : false; // Some use-cases won't require that the PanoMoment is disposed/re-loaded on enter/leave
    this.radius = radius;
    this.identifier = _identifier;
    this.isReady = false;

    this.addEventListener( 'panolens-camera', this.onPanolensCamera.bind( this ) );
    this.addEventListener( 'panolens-orbitcontrols', this.onPanolensOrbitControls.bind( this ) );
    this.addEventListener( 'panolens-viewer', this.onPanolensViewer.bind( this ) );

}

PanoMomentRegular.prototype = Object.assign( Object.create( Panorama.prototype ), {

    constructor: PanoMomentRegular,

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

    /**
     * When viewer reference dispatched
     * @param {THREE.Camera} camera 
     */
    onPanolensViewer: function( { viewer } ) { // HACK
        this.viewer = viewer;
    },

    load: function () {
        this.Texture = new THREE.Texture();   
        this.updateTexture( this.Texture );
        this.PanoMoment = new PanoMoments(this.identifier, this.renderCallback.bind( this ), this.readyCallback.bind( this ), this.loadedCallback.bind( this ));
        this.spinner = new BallSpinerLoader({ groupRadius:20 }); 
        this.spinner.mesh.position.set(0,0,-600);
        this.addSpinner(this.spinner.mesh);
        this.dispatchEvent( { type: 'panoMomentLoad' } );
        this.onLoad();
        console.log("PanoMoment Initialized.");
    },

     /**
     * Add Spinner
     * @param {object} spinner.mesh 
     */
    addSpinner: function ( spinnerMesh ) {
        
        this.camera.add(spinnerMesh);
        spinnerMesh.name='spinner';

    },

     /**
     * Remove Spinner
     * @param {object} spinner.mesh 
     */
    removeSpinner: function ( spinnerMesh ) {

        this.camera.remove(this.camera.getObjectById(spinnerMesh.id));

    },

    /**
     * On Panolens update callback
     */
    updateCallback: function() {
        if (this.camera.getObjectByName('spinner') && this.spinner) { // Not sure if this is expensive to do...
            this.spinner.animate();
        }

        if (this.momentData) { 
            var yaw = THREE.Math.radToDeg(this.camera.rotation.y) + 180; // Find the current viewer Yaw
            if (this.momentData.clockwise) { 
                yaw = (-yaw + 90) % 360; 
            } else {
                yaw = (yaw + 90) % 360; // This needs to be tested on counter clockwise PanoMoments. Haven't done that yet.
            }
            this.setPanoMomentYaw(yaw); // Pass the Yaw to PanoMomentRegular via event
        }
    },

    renderCallback: function (video, momentData) {
        if (!this.momentData) {
            this.momentData = momentData;
            this.OrbitControls.panorama = this;
            this.OrbitControls.AzimuthAngleLimits();
            this.camera.position.copy( this.position );
            this.camera.position.z += 1;

            this.viewer.scene.add(this.camera);
            this.camera.add(this);
            this.position.set(0,0,-2);
            this.material.side = THREE.FrontSide;

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

            viewer.camera.add(viewer.scene.children[0]);
            this.camera.children[3].material.opacity = 1;
            this.camera.children[3].position.set(0,0,-50);
            this.camera.children[3].scale.set(1,1,0.003333333333333334);

            this.OrbitControls.rotateLeft( THREE.Math.degToRad(this.momentData.start_frame + 180) ); // Needed a way to specify a starting viewing angle. Out of the box, OrbitControls doesn't provide this... I'm sure there's some other way to do this though.
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
        this.removeSpinner(this.spinner.mesh);
        this.dispatchEvent( { type: 'panoMomentReady' } );
        console.log("PanoMoment Ready for Rendering.");
    },

    loadedCallback: function (video, momentData) {
        console.log("PanoMoment Download Complete.");
    },

    /**
     * Set PanoMoment yaw
     * @memberOf PanoMomentRegular
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
     * @memberOf PanoMomentRegular
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
     * @memberOf PanoMomentRegular
     * @instance
     */
    onLeave: function () {

        // Remove update callback
        this.dispatchEvent( { 
            type: 'panolens-viewer-handler', 
            method: 'removeUpdateCallback', 
            data: this.updateCallback.bind(this)
        });

        this.removeSpinner(this.spinner.mesh);

        if (this.forceReload) {
            this.isReady = false;
            this.reload = true;
            this.spinner = null;
            this.PanoMoment.dispose(); // This currently doesn't stop an ongoing download which is a bit of an issue... Maybe for later though.
            this.PanoMoment = null; 
            this.momentData = null;
        }

        Panorama.prototype.onLeave.call( this );

    },

    /**
     * Reset
     * @memberOf PanoMomentRegular
     * @instance
     */
    reset: function () {

        Panorama.prototype.reset.call( this );

    },

    /**
     * Dispose
     * @memberOf PanoMomentRegular
     * @instance
     */
    dispose: function () {

        const { material: { map } } = this;

        if ( map ) { map.dispose(); }

        Panorama.prototype.dispose.call( this );

    }

} );

export { PanoMomentRegular };