import { Panorama } from './Panorama';
import {PanoMoments} from '../loaders/PanoMoments.min';
import * as THREE from 'three';

/**
 * @classdesc PanoMomentPanorama based panorama
 * @constructor
 * @param {string} video - Image url or HTMLVideoElement
 */
var globalVideo;
var globalIndex = 0;
var globalPanoMoment;
var globalTexture;
var globalMaterial;

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

    globalPanoMoment = new PanoMoments(this.identifier, renderCallback, readyCallback, loadedCallback);

    function renderCallback  (video, momentData) {
    }

    function readyCallback  (video, momentData) {
        globalVideo = video;
        var myJSON = JSON.stringify(momentData);
        globalIndex = globalPanoMoment.currentIndex;
        console.log("PanoMoment Ready.");
        globalTexture = new THREE.Texture(globalVideo); // UGLY HACK. A lot of this needs to be reworked. I just don't really know how to bind 'this' to callbacks.
        globalTexture.minFilter = globalTexture.magFilter = THREE.LinearFilter;
        globalTexture.generateMipmaps = false;
        globalTexture.format = THREE.RGBFormat;
        const animate = () => {   
                globalPanoMoment.render(globalIndex);
                globalIndex = (globalIndex + 1) % globalPanoMoment.FrameCount;
                globalMaterial.map = globalTexture;
                globalTexture.needsUpdate = true;
                window.requestAnimationFrame( animate );
            };
        animate();
    }

    function loadedCallback (video, momentData) {
        console.log("PanoMoment Download Complete.");
    }

}

PanoMomentPanorama.prototype = Object.assign( Object.create( Panorama.prototype ), {

    constructor: PanoMomentPanorama,

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

        // Release cached image
        THREE.Cache.remove( this.video ); // Not sure this is necessary

        if ( map ) { map.dispose(); }

        Panorama.prototype.dispose.call( this );

    }

} );

export { PanoMomentPanorama };