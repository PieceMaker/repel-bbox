//----------------------------------------------------------------------------------------------------------------------
/// RepelBoxes
///
/// @module
//----------------------------------------------------------------------------------------------------------------------

import normal from 'distributions-normal-random';
import _ from 'lodash';

class RepelBoxes {
    constructor() {
    } // end constructor

    // geom  The geometry key for a 2D GeoJSON feature with point geometry
    // Returns a 2D GeoJSON feature
    _toGeoJSONFeature(geom)
    {
        return {
            "type": "Feature",
            geometry: geom
        };
    } // end _toGeoJSONFeature

    // x A numeric x coordinate
    // y A numeric y coordinate
    // Returns the geometry key for a 2D GeoJSON feature with point geometry
    _toGeoJSONPoint(x, y)
    {
        var point = {
            "type": "Point",
            "coordinates": [x, y]
        };
        return point;
    } // end _toGeoJSONPoint


    // p1  A 2D GeoJSON feature with point geometry
    // p2  A 2D GeoJSON feature with point geometry
    // Returns a 2D GeoJSON feature with point geometry
    _addGeoJSONPoints(p1, p2)
    {
        var x = p1.geometry.coordinates[0] + p2.geometry.coordinates[0];
        var y = p1.geometry.coordinates[1] + p2.geometry.coordinates[1];
        return this._toGeoJSONFeature(
            this._toGeoJSONPoint(x, y)
        );
    } // end _addGeoJSONPoints

    // _euclidean distance between two numeric vectors
    // p1    A 2D GeoJSON feature with point geometry
    // p2    A 2D GeoJSON feature with point geometry
    // Probably exists in turf.js
    // Returns a numeric
    _euclid(p1, p2)
    {
        var retval = Math.pow(p1.geometry.coordinates[0] - p2.geometry.coordinates[0], 2);
        retval += Math.pow(p1.geometry.coordinates[1] - p2.geometry.coordinates[1], 2);
        return retval;
    } // end _euclid

    // Get the coordinates of the center of a box
    // bbox  The bbox key from a 2D GeoJSON feature
    // Returns a 2D GeoJSON point geometry
    _centroid(bbox)
    {
        var x = (bbox[0] + bbox[2]) / 2;
        var y = (bbox[1] + bbox[3]) / 2;
        return this._toGeoJSONPoint(x, y);
    } // end _centroid

    // Move a box into the area specified by x limits and y limits
    // box    A 2D GeoJSON feature with polygon geometry and corresponding bbox key on geometry
    // bound  A 2D GeoJSON feature with polygon geometry and corresponding bbox key on geometry;
    //          representing the target bbox to move the first bbox to
    // Return value is not significant. This modifies the input box argument.
    _putWithinBounds(box, xlim, ylim)
    {
        var d;
        if(box.bbox[0] < xlim[0]) {
            d = Math.abs(box.bbox[0] - xlim[0]);
            box.bbox[0] += d;
            box.bbox[2] += d;
        } else if(box.bbox[2] > xlim[1]) {
            d = Math.abs(box.bbox[2] - xlim[1]);
            box.bbox[0] -= d;
            box.bbox[2] -= d;
        }
        if(box.bbox[1] < ylim[0]) {
            d = Math.abs(box.bbox[1] - ylim[0]);
            box.bbox[1] += d;
            box.bbox[3] += d;
        } else if(box.bbox[3] > ylim[1]) {
            d = Math.abs(box.bbox[3] - ylim[1]);
            box.bbox[1] -= d;
            box.bbox[3] -= d;
        }

        box.geometry = this._centroid(box.bbox);

        return box;
    } // end _putWithinBounds

    // Test if a box _overlaps another box
    // a  The bbox key from a 2D GeoJSON feature
    // b  The bbox key from a 2D GeoJSON feature
    // Returns a boolean
    _overlaps(a, b)
    {
        return (b[0] <= a[2] &&
                b[1] <= a[3] &&
                b[2] >= a[0] &&
                b[3] >= a[1]);
    } // end _overlaps

    // Test if a point is within the boundaries of a box
    // p    The coordinates key from a 2D GeoJSON feature
    // box  The bbox key from a 2D GeoJSON feature
    // Returns a boolean
    _pointWithinBox(p, box)
    {
        return (p[0] >= box[0] &&
                p[0] <= box[2] &&
                p[1] >= box[1] &&
                p[1] <= box[3]);
    } // end _pointWithinBox

    // Compute the repulsion force upon point a from point b.
    //
    // The force decays with the squared distance between the points,
    // similar to the force of repulsion between magnets.
    //
    // from      A 2D GeoJSON feature with point geometry
    // to      A 2D GeoJSON feature with point geometry
    // force  Magnitude of the force (defaults to 1e-6)
    // Returns a 2D GeoJSON feature with point geometry
    _repelForce(from, to, force = 0.000001)
    {

        // Note that this is using a random value. Does this mean the label positions will converge
        // to different locations each time this is run?
        var xFrom = from.geometry.coordinates[0] + normal(1, {'mu': 0, 'sigma': force});
        var yFrom = from.geometry.coordinates[1] + normal(1, {'mu': 0, 'sigma': force});
        var xTo = to.geometry.coordinates[0];
        var yTo = to.geometry.coordinates[1];

        // Constrain the minimum distance to be at least 0.01
        var d = Math.max(
            this._euclid(
                this._toGeoJSONFeature(
                    this._toGeoJSONPoint(xFrom, yFrom)
                ),
                to
            ),
            0.01
        );
        // Compute a unit vector in the direction of the force
        var v = this._toGeoJSONFeature(
            this._toGeoJSONPoint(
                (xFrom - xTo) / d,
                (yFrom - yTo) / d
            )
        );
        // Divide the force by the squared distance
        return this._toGeoJSONFeature(
            this._toGeoJSONPoint(
                v.geometry.coordinates[0] * force / Math.pow(d, 2),
                v.geometry.coordinates[1] * force / Math.pow(d, 2)
            )
        );
    } // end _repelForce

    // Compute the spring force upon point a from point b
    //
    // The force increases with the distance between the points, similar
    // to Hooke's law for springs
    //
    // a      A 2D GeoJSON feature with point geometry
    // b      A 2D GeoJSON feature with point geometry
    // force  Magnitude of the force (defaults to 1e-6)
    // Returns a 2D GeoJSON feature with point geometry
    _springForce(a, b, force = 0.000001)
    {
        var d = this._euclid(a, b);
        d = ((d < 0.01) ? 0 : d);
        // Compute a unit vector in the direction of the force
        var v = this._toGeoJSONFeature(
            this._toGeoJSONPoint(
                (a.geometry.coordinates[0] - b.geometry.coordinates[0]) / d,
                (a.geometry.coordinates[1] - b.geometry.coordinates[1]) / d
            )
        );
        return this._toGeoJSONFeature(
            this._toGeoJSONPoint(
                v.geometry.coordinates[0] * force * d,
                v.geometry.coordinates[1] * force * d
            )
        );
    } // end _springForce

    // Adjust the layout of a list of potentially overlapping boxes
    //
    // centroids  A GeoJSON FeatureCollection where each feature has a bbox key representing the label bbox
    //              and each geometry is a feature point of the a label's centroid.
    // xlim       A numeric array representing the limits on the x axis like [xmin, xmax]
    // ylim       A numeric array representing the limits on the y axis like [ymin, ymax]
    // force      Magnitude of the force (defaults to 1e-6)
    // maxiter    Maximum number of iterations to try to resolve _overlaps (defaults to 2000)
    repelBoxes(centroids, xlim = [-Infinity, Infinity], ylim = [-Infinity, Infinity], force = 0.000001, maxiter = 2000)
    {
        var i, j;
        var n = centroids.features.length;
        var iter = 0;
        var any_overlaps = true;

        var ratios = [];
        var centroid;
        var originalCentroids = _.cloneDeep(centroids);
        var updatedCentroids = _.cloneDeep(centroids);
        for(i = 0; i < n; i++) {
            centroid = updatedCentroids.features[i];
            // height over width
            ratios[i] = (centroid.bbox[3] - centroid.bbox[1]) / (centroid.bbox[2] - centroid.bbox[0]);
        }

        var totalForce = 1;
        var f;
        var ci;
        var cj;
        var fromBox, toBox;

        while(any_overlaps && iter < maxiter && totalForce > 0) {
            if(iter == 0) {
                // Initialize
                totalForce = 0;
            }
            iter += 1;
            any_overlaps = false;

            for(i = 0; i < n; i++) {
                f = this._toGeoJSONFeature(
                    this._toGeoJSONPoint(0, 0)
                );
                fromBox = updatedCentroids.features[i];
                ci = updatedCentroids.features[i];

                // Do we really want to compare all points to each other twice?
                // Maybe this could be changed to var j = i+1?
                for(j = 0; j < n; j++) {
                    toBox = updatedCentroids.features[j];
                    cj = updatedCentroids.features[j];

                    if(i == j) {
                        // Repel the box from its own centroid.
                        if(this._pointWithinBox(originalCentroids.features[i].geometry.coordinates, fromBox.bbox)) {
                            any_overlaps = true;
                            f = this._addGeoJSONPoints(
                                f,
                                this._repelForce(ci, originalCentroids.features[i], force)
                            );
                        }
                    } else {
                        // Repel the box from overlapping boxes.
                        if(this._overlaps(fromBox, toBox)) {
                            any_overlaps = true;
                            f = this._addGeoJSONPoints(
                                f,
                                this._repelForce(ci, cj, force)
                            );
                        }
                        // Repel the box from overlapping centroids.
                        if(this._pointWithinBox(originalCentroids.features[j].geometry.coordinates, fromBox.bbox)) {
                            any_overlaps = true;
                            f = this._addGeoJSONPoints(
                                f,
                                this._repelForce(ci, originalCentroids.features[j], force)
                            );
                        }
                    }
                }

                // Pull toward the label's point
                if(!any_overlaps) {
                    f = this._addGeoJSONPoints(
                        f,
                        this._springForce(originalCentroids.features[i], ci, force)
                    );
                }

                // Scale the x force by the ratio of height/width
                f.geometry.coordinates[0] = f.geometry.coordinates[0] * ratios[i];

                // Dampen the forces
                f.geometry.coordinates[0] = f.geometry.coordinates[0] * (1 - 0.001);
                f.geometry.coordinates[1] = f.geometry.coordinates[1] * (1 - 0.001);

                totalForce += Math.abs(f.geometry.coordinates[0]) + Math.abs(f.geometry.coordinates[1]);

                updatedCentroids.features[i].bbox = [
                    fromBox.bbox[0] + f.geometry.coordinates[0],
                    fromBox.bbox[1] + f.geometry.coordinates[1],
                    fromBox.bbox[2] + f.geometry.coordinates[0],
                    fromBox.bbox[3] + f.geometry.coordinates[1]
                ];
                // This modifies updatedCentroids.features[i]
                this._putWithinBounds(updatedCentroids.features[i], xlim, ylim);
                // Update the centroids to be the center of the latest position of their bounding box
                updatedCentroids.features[i].geometry = this._centroid(updatedCentroids.features[i].bbox);
            }
        }

        //console.log(iter);

        for(i = 0; i < n; i++) {
            centroid = updatedCentroids.features[i];
            updatedCentroids.features[i] = this._toGeoJSONPoint(
                (centroid.bbox[0] + centroid.bbox[2]) / 2,
                (centroid.bbox[1] + centroid.bbox[3]) / 2
            );
        }

        return updatedCentroids;
    } // end repelBoxes;

} // end RepelBoxes

//----------------------------------------------------------------------------------------------------------------------

module.exports = RepelBoxes;

//----------------------------------------------------------------------------------------------------------------------
