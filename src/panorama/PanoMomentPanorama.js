import { Panorama } from './Panorama';
import {PanoMoments} from '../loaders/PanoMoments.min';
import * as THREE from 'three';

/**
 * @classdesc PanoMomentPanorama based panorama
 * @constructor
 * @param {string} video - Image url or HTMLVideoElement
 */

// All ugly hacks :(
var globalVideo;
var globalPanoMoment;
var globalTexture;
var globalMaterial;
var globalMomentData;

function PanoMomentPanorama ( identifier, _geometry, _material ) {

    const radius = 5000;
    const geometry = _geometry || new THREE.SphereBufferGeometry( radius, 60, 40 );
    globalMaterial = _material || new THREE.MeshBasicMaterial( { opacity: 0, transparent: true } );
       
    Panorama.call( this, geometry, globalMaterial );

    this.radius = radius;
    this.identifier = identifier;

    globalTexture = new THREE.Texture(globalVideo);
    globalTexture.minFilter = globalTexture.magFilter = THREE.LinearFilter;
    globalTexture.generateMipmaps = false;
    globalTexture.format = THREE.RGBFormat;
    
    this.updateTexture( globalTexture );

    globalPanoMoment = new PanoMoments(this.identifier, this.renderCallback, this.readyCallback, this.loadedCallback);

}

PanoMomentPanorama.prototype = Object.assign( Object.create( Panorama.prototype ), {

    constructor: PanoMomentPanorama,

    renderCallback: function (video, momentData) {
    },

    readyCallback: function (video, momentData) { // FYI the start frame should be displayed without the user calling Render (and before the readyCallback is fired) -- I'm not yet sure if this is a bug in the Web SDK or somewhere in this code. TBD. Compare the PanoMoment.html viewer vs. https://my.panomoments.com/u/dustinkerstein/m/grand-central
        globalVideo = video;
        globalMomentData = momentData;
        globalTexture = new THREE.Texture(globalVideo); // UGLY HACK. A lot of this needs to be reworked. I just don't really know how to bind 'this' to callbacks.
        globalTexture.minFilter = globalTexture.magFilter = THREE.LinearFilter;
        globalTexture.generateMipmaps = false;
        globalTexture.format = THREE.RGBFormat;
        console.log("PanoMoment Ready for Rendering.");
    },

    loadedCallback: function (video, momentData) {
        console.log("PanoMoment Download Complete.");
    },

    setInstanceVariables: function () { // Really ugly hack due to me not knowing how to use 'this' and callbacks properly
        if (globalVideo) {
            this.globalMomentData = globalMomentData; 
        }
    },

    /**
     * Set PanoMoment yaw
     * @memberOf PanoMomentPanorama
     * @instance
     * @param {object} event - Event contains float. 0.0 to 360.0
     */

    setPanoMomentYaw: function (yaw) {

        if (globalVideo) {
            const yawDerivedFrame =  (yaw / 360) * globalPanoMoment.FrameCount;
            globalPanoMoment.render(yawDerivedFrame);
            globalMaterial.map = globalTexture; // Appears to be needed even though it shouldn't be. Likely related to the hacky design / workaround for not passing 'this' in the callbacks
            if (globalPanoMoment.textureReady) {
                globalTexture.needsUpdate = true;
            }
        }

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

        // this.removeEventListener( 'set-yaw', this.setPanoMomentYaw.bind( this ) );

        const { material: { map } } = this;

        // Release cached image
        THREE.Cache.remove( this.video ); // Not sure this is necessary

        if ( map ) { map.dispose(); }

        Panorama.prototype.dispose.call( this );

    }

} );

export { PanoMomentPanorama };