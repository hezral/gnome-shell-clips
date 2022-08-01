'use strict';
/* containers.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* exported init */

const { Clutter, St, GObject, Gio, GLib, Gdk, GdkPixbuf } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const _ = ExtensionUtils.gettext;

// Normal FlowLayout doesn't work in a ScrollView. Overriding
// `vfunc_get_preferred_height` to return the `natHeight` as `minHeight`
// fixes this.
var ClipsAppFlowLayout = GObject.registerClass(
class ClipsAppFlowLayout extends Clutter.FlowLayout {
    _init() {
        super._init({
            orientation: Clutter.Orientation.HORIZONTAL,
            homogeneous: false,
            column_spacing: 10,
            row_spacing: 10,
        });
    }
    vfunc_get_preferred_height(container, forWidth) {
        const [minHeight, natHeight] = super.vfunc_get_preferred_height(container, forWidth);
        return [natHeight, natHeight];
    }
});


var ClipsAppGrid = GObject.registerClass(
class ClipsAppGrid extends St.Widget {
    _init() {
        super._init({
            layout_manager: new Clutter.BoxLayout({ orientation: Clutter.Orientation.VERTICAL, spacing: 6 }),
            width: 424,
            height: 320,
        });
        this.add_style_class_name('clips-app-grid');

        this._scrollView = new St.ScrollView({
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            x_expand: true,
            overlay_scrollbars: true
        });
        this.add_actor(this._scrollView);

        this._flowbox = new St.Viewport({
            layout_manager: new ClipsAppFlowLayout(),
            x_expand: true,
            y_expand: true
        });
        this._scrollView.add_actor(this._flowbox);
    }
});


var ClipsBaseContainer = GObject.registerClass(
class ClipsBaseContainer extends PopupMenu.PopupBaseMenuItem {
    _init(type, filepath, params) {
        super._init(params);
        this.remove_child(this._ornamentLabel); //not needed
        this.style = `padding: 2px;`; //remove default padding which is not balanced left/right

        // this.add_style_class_name('clips-container-base');

        switch(type) {
            case 'image':
                // code block
                var container = ClipsImageContainer;
                break;
            case 'plaintext':
                // code block
                break;
            default:
                // code block
                break;
        }

        var clip = new container(this, filepath,);
        this.add_child(clip);        
    }
});
    

var ClipsImageContainer = GObject.registerClass(
class ClipsImageContainer extends St.Widget {
    _init(parent, filepath) {
        super._init({
            style_class: 'clips-container',
            layout_manager: new Clutter.GridLayout({ orientation: Clutter.Orientation.VERTICAL }),
            x_expand: false,
            y_expand: false,
        });

        this._width = 200;
        this._height = 160;

        // if (filepath.includes('.gif')) {
        //     this.pixbuf = GdkPixbuf.PixbufAnimation.new_from_file(filepath);
        //     this.iter = this.pixbuf.get_iter();
        //     this.alpha = this.iter.get_has_alpha();
        // }

        this.pixbuf = GdkPixbuf.Pixbuf.new_from_file(filepath);
        this.alpha = this.pixbuf.get_has_alpha();
        
        this.ratio_w_h = this.pixbuf.width / this.pixbuf.height;
        this.ratio_h_w = this.pixbuf.height / this.pixbuf.width;
        
        log(parent.width, parent.height);

        this.clip_image_type = new St.DrawingArea({ 
            // style_class: 'clips-sub-container' 
            width: this._width,
            height: this._height,
        });
        this.clip_image_type.connect('repaint', () => this.repaintImage());
        this.layout_manager.attach(this.clip_image_type, 0, 0, 1, 1);

        if (this.alpha) {
            this.style = `background-image: url("${Me.path}/images/checkerboard.svg"); background-repeat: repeat; background-color: transparent;`;
        }
        
    }
    
    repaintImage() {
        let radius = 4;
        let pi = Math.PI;
        let final_pixbuf = null;
        let y = 0;
        let x = 0;

        let [width, height] = this.clip_image_type.get_surface_size();
        let ctx = this.clip_image_type.get_context();

        // if (this.type == 'gif') {
        //     pixbuf = GdkPixbuf.PixbufAnimationIter.get_pixbuf(this.iter);
        // } else {
        //     pixbuf = this.pixbuf;
        // }

        this.fitted_pixbuf = GdkPixbuf.Pixbuf.new(this.pixbuf.get_colorspace(), this.pixbuf.get_has_alpha(), this.pixbuf.get_bits_per_sample(), width, height);

        if (Math.round(width * this.ratio_h_w) < height) {
            this.scaled_pixbuf = this.pixbuf.scale_simple(Math.round(height * this.ratio_w_h), height, GdkPixbuf.InterpType.BILINEAR);
        } else {
            this.scaled_pixbuf = this.pixbuf.scale_simple(width, Math.round(width * this.ratio_h_w), GdkPixbuf.InterpType.BILINEAR);
        }

        if (this.pixbuf.width * this.pixbuf.height < width * height) {
            // # Find the offset we need to center the source pixbuf on the destination since its smaller
            y = Math.abs((height - this.pixbuf.height) / 2);
            x = Math.abs((width - this.pixbuf.width) / 2);
            final_pixbuf = this.pixbuf;
        } else {
            // # Find the offset we need to center the source pixbuf on the destination
            y = Math.abs((height - this.scaled_pixbuf.height) / 2);
            x = Math.abs((width - this.scaled_pixbuf.width) / 2);
            this.scaled_pixbuf.copy_area(x, y, width, height, this.fitted_pixbuf, 0, 0);
            // # Set coordinates for cairo surface since this has been fitted, it should be (0, 0) coordinate
            y = 0;
            x = 0;
            final_pixbuf = this.fitted_pixbuf;
        }

        ctx.save();
        
        // draws rounded rectangle
        ctx.arc(width - radius, radius, radius, 0-pi/2, 0); //# top-right-corner
        ctx.arc(width - radius, height - radius, radius, 0, pi/2); //# bottom-right-corner
        ctx.arc(radius, height - radius, radius, pi/2, pi); //# bottom-left-corner
        ctx.arc(radius, radius, radius, pi, pi + pi/2); //# top-left-corner
  
        Gdk.cairo_set_source_pixbuf(ctx, final_pixbuf, x, y)

        ctx.clip();
        ctx.paint();
        ctx.restore();

        ctx.$dispose();
    }
});