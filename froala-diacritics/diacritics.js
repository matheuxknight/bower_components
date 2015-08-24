/**
 * "Inspired" by colors plugin by Froala team
 */
(function ($) {
    $.Editable.DEFAULTS = $.extend($.Editable.DEFAULTS, {
        diacritics: {
            // Array of special characters to use in simple text and long answer input
            lowercase: [
                'á', 'é', 'í', 'ó', 'ú',
                'à', 'è', 'ì', 'ò', 'ù',
                'â', 'ê', 'î', 'ô', 'û',
                'ä', 'ë', 'ï', 'ö', 'ü',
                'ã', 'õ', 'ñ', 'ý', 'ÿ',
                'å', 'ç', 'œ', 'ø', 'æ'
            ],
            uppercase: [
                'Á', 'É', 'Í', 'Ó', 'Ú',
                'À', 'È', 'Ì', 'Ò', 'Ù',
                'Â', 'Ê', 'Î', 'Ô', 'Û',
                'Ä', 'Ë', 'Ï', 'Õ', 'Ü',
                'Ã', 'Õ', 'Ñ', 'Ý', 'Ÿ',
                'Å', 'Ç', 'Œ', 'Ø', 'Æ'
            ],
            symbol: [
                '¿', '¡', '°', '«', '»',
                '‹', '›', '€', '¢', '£',
                '¥', 'ƒ', '¼', '½', '¾'
            ]
        },

        defaultGroup: 'lowercase',
        perLine: 10
    });

    $.Editable.commands = $.extend($.Editable.commands, {
        diacritics: {
            icon: 'fa fa-terminal',
            title: 'Virtual Keyboard',
            callback: function (cmd, val, param) {
                this[param].apply(this, [val]);
            },
            callbackWithoutSelection: function (cmd, val, param) {
                this[param].apply(this, [val]);
            },
            undo: true
        }
    });

    $.Editable.prototype.command_dispatcher = $.extend($.Editable.prototype.command_dispatcher, {
        diacritics: function (command) {
            var dropdown = this.buildDiacriticsDropdown(command);
            var btn = this.buildDropdownButton(command, dropdown, 'fr-diacritic-picker');
            return btn;
        }
    });

    /**
     * Dropdown for diacritics.
     *
     * @param command
     * @returns {*}
     */
    $.Editable.prototype.buildDiacriticsDropdown = function () {
        var active = '';
        var dropdown = '<div class="fr-dropdown-menu">';

        for (groupKey in this.options.diacritics) {
            dropdown += this.buildDiacriticsList(groupKey, this.options.diacritics[groupKey]);
        }

        dropdown += '<p>';

        for (groupKey in this.options.diacritics) {
            active = (this.options.defaultGroup == groupKey ? 'active' : '');
            dropdown += '<span class="fr-choose-diacritic ' + active + '" data-text="true" data-param="' + groupKey + '" style="width: ' + 100 / _.size(this.options.diacritics) + '%;">' + groupKey + '</span>';
        }

        dropdown += '</p></div>';

        this.$bttn_wrapper.on(this.mousedown, '.fr-choose-diacritic', function (e) {
            e.preventDefault();
            e.stopPropagation();

            if (e.type === 'mousedown' && e.which !== 1) return true;
        })

        var that = this;
        this.$bttn_wrapper.on(this.mouseup, '.fr-choose-diacritic', function (e) {
            e.preventDefault();
            e.stopPropagation();

            if (e.type === 'mouseup' && e.which !== 1) return true;

            var $this = $(this);
            $this.siblings().removeClass('active');
            $this.addClass('active');

            $this.parents('.fr-dropdown-menu').find('.fr-diacritic-set').hide();
            $this.parents('.fr-dropdown-menu').find('.fr-diacritic-set.fr-' +  $this.attr('data-param')).show();
        });

        return dropdown;
    };

    $.Editable.prototype.buildDiacriticsList = function (group, characters) {
        var display = (this.options.defaultGroup == group ? 'block' : 'none');

        // Diacritic group headline.
        var diaGroupNode = '<div class="fr-diacritic-set fr-' + group + '" style="display: ' + display + '">';

        // Iterate diacritic chars.
        for (var k = 0; k < characters.length; k++) {
            diaGroupNode += '<button type="button" class="fr-diacritic-bttn" data-cmd="diacritics" data-val="' + characters[k] + '" data-param="insertCharacter">' + characters[k] + '</button>';

            // New line.
            if (k % this.options.perLine == (this.options.perLine - 1) && k > 0) {
                diaGroupNode += '<hr/>';
            }
        }

        diaGroupNode += '</div>';

        return diaGroupNode;
    };

    $.Editable.prototype.insertCharacter = function (val) {
        this.insertHTML(val);
    }
})(jQuery);
