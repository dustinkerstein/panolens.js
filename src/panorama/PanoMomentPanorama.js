import { Panorama } from './Panorama';
// import { TextureLoader } from '../loaders/TextureLoader';
import * as THREE from 'three';

/**
 * @classdesc PanoMomentPanorama based panorama
 * @constructor
 * @param {string} video - Image url or HTMLVideoElement
 */
function PanoMomentPanorama ( video, _geometry, _material ) {

    const radius = 5000;
    const geometry = _geometry || new THREE.SphereBufferGeometry( radius, 60, 40 );
    const material = _material || new THREE.MeshBasicMaterial( { opacity: 0, transparent: true } );

    Panorama.call( this, geometry, material );

    this.video = video;
    this.radius = radius;

}

PanoMomentPanorama.prototype = Object.assign( Object.create( Panorama.prototype ), {

    constructor: PanoMomentPanorama,

    /**
     * Load PanoMomentPanorama asset
     * @param  {*} video - Video element
     * @memberOf PanoMomentPanorama
     * @instance
     */
    load: function ( video ) {

        video = video || this.video;

        if ( !video ) { 

            console.warn( 'Video undefined' );

            return; 

        } else if ( video instanceof HTMLVideoElement ) {

            this.onLoad( new THREE.Texture( video ) );

        }

    },

    /**
     * This will be called when PanoMomentPanorama is loaded
     * @param  {THREE.Texture} texture - Texture to be updated
     * @memberOf PanoMomentPanorama
     * @instance
     */
    onLoad: function ( texture ) {

        texture.minFilter = texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.format = THREE.RGBFormat;
        
        this.updateTexture( texture );

        window.requestAnimationFrame( Panorama.prototype.onLoad.bind( this ) );

        const loaded = () => {
                texture.needsUpdate = true;
                window.requestAnimationFrame( loaded );
            };
            loaded();
        
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

        // Release cached image
        THREE.Cache.remove( this.video ); // Not sure this is necessary

        if ( map ) { map.dispose(); }

        Panorama.prototype.dispose.call( this );

    }

} );

export { PanoMomentPanorama };