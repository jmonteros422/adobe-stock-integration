// jscs:disable
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */
// jscs:enable
define([
    'uiComponent',
    'uiRegistry',
    'jquery',
    'Magento_AdobeStockImageAdminUi/js/media-gallery',
    'Magento_Ui/js/modal/confirm',
    'Magento_Ui/js/modal/prompt',
    'text!Magento_AdobeStockImageAdminUi/template/modal/adobe-modal-prompt-content.html'
], function (Component, uiRegistry, $, mediaGallery, confirmation, prompt, adobePromptContentTmpl) {
    'use strict';

    return Component.extend({
        defaults: {
            template: 'Magento_AdobeStockImageAdminUi/grid/column/preview/actions',
            loginProvider: 'name = adobe-login, ns = adobe-login',
            mediaGallerySelector: '.media-gallery-modal:has(#search_adobe_stock)',
            adobeStockModalSelector: '.adobe-search-images-modal',
            downloadImagePreviewUrl: 'adobe_stock/preview/download',
            licenseAndDownloadUrl: 'adobe_stock/license/license',
            saveLicensedAndDownloadUrl: 'adobe_stock/license/saveLicensed',
            buyCreditsUrl: 'https://stock.adobe.com/',
            messageDelay: 5,
            imageItems: [],
            mediaGalleryProvider: 'media_gallery_listing.media_gallery_listing_data_source',
            listens: {
                '${ $.provider }:data.items': 'updateActions'
            },
            modules: {
                login: '${ $.loginProvider }',
                preview: '${ $.parentName }.preview',
                overlay: '${ $.parentName }.overlay',
                source: '${ $.provider }',
                messages: '${ $.messagesName }'
            },
            imports: {
                imageItems: '${ $.mediaGalleryProvider }:data.items'
            }
        },

        /**
         * Init observable variables
         *
         * @return {Object}
         */
        initObservable: function () {
            this._super()
                .observe([
                    'imageItems'
                ]);

            return this;
        },

        /**
         * Update displayed record data on data source update
         */
        updateActions: function () {
            var displayedRecord = this.preview().displayedRecord(),
                updatedDisplayedRecord = this.preview().displayedRecord(),
                records = this.source().data.items,
                index;

            if (typeof displayedRecord.id === 'undefined') {
                return;
            }

            for (index = 0; index < records.length; index++) {
                if (records[index].id === displayedRecord.id) {
                    updatedDisplayedRecord = records[index];
                    break;
                }
            }

            this.preview().displayedRecord(updatedDisplayedRecord);
        },

        /**
         * Returns is_downloaded flag as observable for given record
         *
         * @returns {observable}
         */
        isDownloaded: function () {
            return this.preview().displayedRecord()['is_downloaded'];
        },

        /**
         * Is asset licensed in adobe stock in context of currently logged in account
         *
         * @returns {observable}
         */
        isLicensed: function () {
            return this.overlay().licensed()[this.preview().displayedRecord().id] && !this.isLicensedLocally();
        },

        /**
         * Is licensed version of asset saved locally
         *
         * @returns {observable}
         */
        isLicensedLocally: function () {
            return this.preview().displayedRecord()['is_licensed_locally'];
        },

        /**
         * Locate downloaded image in media browser
         */
        locate: function () {
            this.preview().getAdobeModal().trigger('closeModal');
            this.selectDisplayedImageInMediaGallery();
        },

        /**
         * Selects displayed image in media gallery
         */
        selectDisplayedImageInMediaGallery: function () {
            if (!this.isMediaBrowser()) {
                this.selectDisplayedImageForNewMediaGallery()
            } else {
                this.selectDisplayedImageForOldMediaGallery();
            }
        },

        /**
         * Selects displayed image in media gallery for old gallery
         */
        selectDisplayedImageForOldMediaGallery: function () {
            var image = mediaGallery.locate(this.preview().displayedRecord().path);

            image ? image.click() : mediaGallery.notLocated();
        },

        /**
         * Selects displayed image in media gallery for new gallery
         */
        selectDisplayedImageForNewMediaGallery: function () {
            var self = this,
                imagePath = self.preview().displayedRecord().path,
                imageFolders = mediaGallery.getImageFolders(imagePath),
                imageFilename = imagePath.substring(imagePath.lastIndexOf('/') + 1),
                locatedImage = $('div[data-row="file"]:has(img[alt=\"' + imageFilename + '\"])'),
                image,
                subscription;

            if (!locatedImage.length) {
                subscription = this.imageItems.subscribe(function () {
                    locatedImage = $('div[data-row="file"]:has(img[alt=\"' + imageFilename + '\"])');
                    image = locatedImage.length ? locatedImage : false;

                    if (!image) {
                        mediaGallery.notLocated();

                        return;
                    }

                    self.selectRecord(image);
                    subscription.dispose();
                });
            }

            if (imageFolders.length) {
                imageFolders[0].click();
            }

            if (locatedImage.length) {
                this.selectRecord(locatedImage);
            }
        },

        /**
         * Set the record as selected
         *
         * @param image
         */
        selectRecord: function (image) {
            var recordIndex = image.closest('.masonry-image-column').data('repeat-index'),
                record = this.imageItems()[recordIndex];

            uiRegistry.get('index = thumbnail_url').selected(record);
        },

        /**
         * Save preview
         */
        savePreview: function () {
            this.getPrompt(
                {
                    'title': $.mage.__('Save Preview'),
                    'content': $.mage.__('File Name'),
                    'visible': true,
                    'actions': {
                        confirm: function (fileName) {
                            $.ajaxSetup({
                                async: true
                            });
                            this.save(this.preview().displayedRecord(), fileName);
                        }.bind(this)
                    },
                    'buttons': [{
                        text: $.mage.__('Cancel'),
                        class: 'action-secondary action-dismiss',

                        /**
                         * Close modal on button click
                         */
                        click: function () {
                            this.closeModal();
                        }
                    }, {
                        text: $.mage.__('Confirm'),
                        class: 'action-primary action-accept'
                    }]

                }
            );
        },

        /**
         * Save record as image
         *
         * @param {Object} record
         * @param {String} fileName
         * @param {bool} license
         * @param {bool} isLicensed
         */
        save: function (record, fileName, license, isLicensed) {
            var mediaBrowser = $(this.preview().mediaGallerySelector).data('mageMediabrowser'),
                requestUrl = isLicensed ? this.preview().saveLicensedAndDownloadUrl :
                    license ? this.preview().licenseAndDownloadUrl : this.preview().downloadImagePreviewUrl,
                destinationPath = (mediaBrowser.activeNode.path || '') + '/' + fileName + '.' +
                    this.getImageExtension(record);

            $.ajax({
                type: 'POST',
                url: requestUrl,
                dataType: 'json',
                showLoader: true,
                data: {
                    'media_id': record.id,
                    'destination_path': destinationPath
                },
                context: this,

                /**
                 * Success handler for Adobe Stock preview or licensed image
                 * download
                 *
                 */
                success: function () {
                    record['is_downloaded'] = 1;

                    if (record.path === '') {
                        record.path = destinationPath;
                    }

                    if (license || isLicensed) {
                        record['is_licensed'] = 1;
                        record['is_licensed_locally'] = 1;
                        this.login().getUserQuota();
                    }
                    this.preview().displayedRecord(record);
                    this.source().reload({
                        refresh: true
                    });
                    this.preview().getAdobeModal().trigger('closeModal');
                    $.ajaxSetup({
                        async: false
                    });
                    mediaBrowser.reload();
                    $.ajaxSetup({
                        async: true
                    });
                    this.selectDisplayedImageInMediaGallery();
                },

                /**
                 * Error handler for Adobe Stock preview or licensed image
                 * download
                 *
                 * @param {Object} response
                 */
                error: function (response) {
                    var message;

                    if (typeof response.responseJSON === 'undefined' ||
                        typeof response.responseJSON.message === 'undefined'
                    ) {
                        message = 'There was an error on attempt to save the image!';
                    } else {
                        message = response.responseJSON.message;

                        if (response.responseJSON['is_licensed'] === true) {
                            record['is_licensed'] = 1;
                            this.preview().displayedRecord(record);
                            this.source().reload({
                                refresh: true
                            });
                        }
                    }
                    this.messages().add('error', message);
                    this.messages().scheduleCleanup(this.messageDelay);
                }
            });
        },

        /**
         * Is the media browser used in the content of the grid
         *
         * @returns {Boolean}
         */
        isMediaBrowser: function () {
            let mediaBrowser = $(this.preview().mediaGallerySelector).data('mageMediabrowser');

            return typeof mediaBrowser !== 'undefined';
        },

        /**
         * Generate meaningful name image file,
         * allow only alphanumerics, dashes, and underscores
         *
         * @param {Object} record
         * @return string
         */
        generateImageName: function (record) {
            var fileName = record.title.substring(0, 32)
                .replace(/[^a-zA-Z0-9_]/g, '-')
                .replace(/-{2,}/g, '-')
                .toLowerCase();

            /* If the filename does not contain latin chars, use ID as a filename */
            return fileName === '-' ? record.id : fileName;
        },

        /**
         * Get image file extension
         *
         * @param {Object} record
         * @return string
         */
        getImageExtension: function (record) {
            return record['content_type'].match(/[^/]{1,4}$/);
        },

        /**
         * Get messages
         *
         * @return {Array}
         */
        getMessages: function () {
            return this.messages().get();
        },

        /**
         * License and save image
         *
         * @param {Object} record
         * @param {String} fileName
         */
        licenseAndSave: function (record, fileName) {
            this.save(record, fileName, true);
        },

        /**
         * Shows license confirmation popup with information about current license quota
         *
         * @param {Object} record
         */
        showLicenseConfirmation: function (record) {
            $.ajax(
                {
                    type: 'GET',
                    url: this.preview().confirmationUrl,
                    dataType: 'json',
                    data: {
                        'media_id': record.id
                    },
                    context: this,
                    showLoader: true,

                    /**
                     * On success result
                     *
                     * @param {Object} response
                     */
                    success: function (response) {
                        var confirmationContent = $.mage.__('License "' + record.title + '"'),
                            quotaMessage = response.result.message,
                            canPurchase = response.result.canLicense,
                            buyCreditsUrl = this.preview().buyCreditsUrl,
                            displayFieldName = !this.isDownloaded() ? '<b>' + $.mage.__('File Name') + '</b>' : '',
                            title = $.mage.__('License Adobe Stock Images?'),
                            cancelText = $.mage.__('Cancel'),
                            baseContent = '<p>' + confirmationContent + '</p><p><b>' + quotaMessage + '</b></p><br>';

                        if (canPurchase) {
                            this.getPrompt(
                                 {
                                    'title': title,
                                    'content': baseContent + displayFieldName,
                                    'visible': !this.isDownloaded(),
                                    'actions': {
                                        /**
                                         * Confirm action
                                         */
                                        confirm: function (fileName) {
                                            if (typeof fileName === 'undefined') {
                                                fileName = this.getImageNameFromPath(record.path);
                                            }

                                            this.licenseAndSave(record, fileName);
                                        }.bind(this)
                                    },
                                    'buttons': [{
                                        text: cancelText,
                                        class: 'action-secondary action-dismiss',

                                        /**
                                         * Close modal
                                         */
                                        click: function () {
                                            this.closeModal();
                                        }
                                    }, {
                                        text: $.mage.__('Confirm'),
                                        class: 'action-primary action-accept'
                                    }]

                                }
                            );
                        } else {
                            confirmation({
                                title: title,
                                content: baseContent,
                                buttons: [{
                                    text: cancelText,
                                    class: 'action-secondary action-dismiss',

                                    /**
                                     * Close modal
                                     */
                                    click: function () {
                                        this.closeModal();
                                    }
                                },{
                                    text: $.mage.__('Buy Credits'),
                                    class: 'action-primary action-accept',

                                    /**
                                     * Close modal
                                     */
                                    click: function () {
                                        window.open(buyCreditsUrl);
                                        this.closeModal();
                                    }
                                }]
                            });
                        }
                    },

                    /**
                     * On error
                     */
                    error: function (response) {
                        var defaultMessage = 'Failed to fetch licensing information.',
                            errorMessage = response.JSON ? response.JSON.meassage : defaultMessage;

                        if (response.status === 403) {
                            errorMessage = $.mage.__('Your admin role does not have permissions to license an image');
                        }

                        this.messages().add('error', errorMessage);
                        this.messages().scheduleCleanup(this.messageDelay);
                    }
                }
            );
        },

        /**
         * Return configured  prompt with input field.
         */
        getPrompt: function (data) {

            prompt({
                title: data.title,
                content:  data.content,
                value: this.generateImageName(this.preview().displayedRecord()),
                imageExtension: this.getImageExtension(this.preview().displayedRecord()),
                visible: data.visible,
                promptContentTmpl: adobePromptContentTmpl,
                modalClass: 'adobe-stock-save-preview-prompt',
                validation: true,
                promptField: '[data-role="adobe-stock-image-name-field"]',
                validationRules: ['required-entry', 'validate-image-name'],
                attributesForm: {
                    novalidate: 'novalidate',
                    action: '',
                    onkeydown: 'return event.key != \'Enter\';'
                },
                attributesField: {
                    name: 'name',
                    'data-validate': '{required:true}',
                    maxlength: '128'
                },
                context: this,
                actions: data.actions,
                buttons: data.buttons
            });

        },

        /**
         * Process of license
         */
        licenseProcess: function () {
            $.ajaxSetup({
                async: false
            });
            this.login().login()
                .then(function () {
                    if (this.isLicensed()) {
                        this.saveLicensed();
                    } else {
                        this.showLicenseConfirmation(this.preview().displayedRecord());
                    }
                    $.ajaxSetup({
                        async: true
                    });
                }.bind(this))
                .catch(function (error) {
                    this.messages().add('error', error);
                }.bind(this))
                .finally(function () {
                    this.messages().scheduleCleanup(this.messageDelay);
                }.bind(this));
        },

        /**
         * Save licensed
         */
        saveLicensed: function () {
            var imageName = '';

            if (!this.login().user().isAuthorized) {
                return;
            }

            if (!this.isLicensed()) {
                return;
            }

            // If there's a copy of the image (preview), get the filename from the copy
            if (this.preview().displayedRecord().path !== '') {
                imageName = this.getImageNameFromPath(this.preview().displayedRecord().path);
                this.save(this.preview().displayedRecord(), imageName, false, true);

                return;
            }

            // Ask user for the image name otherwise
            this.getPrompt(
                {
                    'title': $.mage.__('Save'),
                    'content': $.mage.__('File Name'),
                    'visible': true,
                    'actions': {
                        confirm: function (fileName) {
                            this.save(this.preview().displayedRecord(), fileName, false, true);
                        }.bind(this)
                    },
                    'buttons': [
                        {
                            text: $.mage.__('Cancel'),
                            class: 'action-secondary action-dismiss',

                            /**
                             * Close modal on button click
                             */
                            click: function () {
                                this.closeModal();
                            }
                        },
                        {
                            text: $.mage.__('Confirm'),
                            class: 'action-primary action-accept'
                        }
                    ]
                }
            );
        },

        /**
         * Returns license button title depending on the existing saved preview
         *
         * @returns {String}
         */
        getLicenseButtonTitle: function () {
            return this.isDownloaded() ?  $.mage.__('License') : $.mage.__('License and Save');
        },

        /**
         * Extracts image name from its path
         *
         * @param {String} path
         * @returns {String}
         */
        getImageNameFromPath: function (path) {
            var filePathArray = path.split('/'),
                imageIndex = filePathArray.length - 1;

            return filePathArray[imageIndex].substring(0, filePathArray[imageIndex].lastIndexOf('.'));
        }
    });
});
