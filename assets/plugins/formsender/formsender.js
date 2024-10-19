(function () {
    class FormSenderEvent {
        constructor(target, name, data) {
            this.event = new CustomEvent(name, {
                cancelable: true,
                bubbles: true,
                detail: data
            });

            target.dispatchEvent(this.event);

            if (window.jQuery) {
                this.$event = $.Event(name);
                jQuery(target).trigger(this.$event, data);
            }
        }

        isPrevented() {
            if (this.event.defaultPrevented) {
                return true;
            }

            if (window.jQuery) {
                if (this.$event.isDefaultPrevented() || typeof this.$event.result != 'undefined' && this.$event.result === false) {
                    return true;
                }
            }

            return false;
        }
    }

    class FormSenderMessager {
        constructor(infoMessage, errorMessage) {
            this.info = alert;
            this.error = alert;
            if (typeof infoMessage === 'function') {
                this.info = infoMessage;
            }
            if (typeof errorMessage === 'function') {
                this.error = errorMessage;
            }
        }

        message(type, messages) {
            const that = this;
            if (typeof messages === 'object' && messages.constructor === Array) {
                if (messages.length > 0) {
                    messages.forEach(item => that.message(type, item));
                }
            } else {
                const messager = type === 'error' ? this.error : this.info;
                messager.call(window, messages)
            }
        }
    }

    class FormSender {
        options = {
            formWrapper: '.form-wrapper',
            submitBtn: '[type=submit]',
            errorClass: 'has-error',
            errorMessageElement: 'div',
            errorMessageClass: 'help-block',
            successMessageText: 'The form has been sent successfully',
            errorMessageText: 'Failed to send',
            url: '/forms',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        };

        messager = new FormSenderMessager(alert, alert);

        constructor(options = {}) {
            if (typeof options !== 'object') throw new Error('Wrong options');

            if (typeof options.headers === 'object') {
                Object.assign(this.options.headers, options.headers);
            }
            delete options.headers;

            if (typeof options.messager === 'object' && options.messager.constructor === FormSenderMessager) {
                this.messager = options.messager;
                delete options.messager;
            }
            Object.assign(this.options, options);

            this.init();
        }

        init() {
            const wrappers = document.querySelectorAll(this.options.formWrapper);
            const that = this;
            wrappers.forEach(wrapper => {
                const form = wrapper.querySelector('form');
                if (form) {
                    form.addEventListener('submit', that.submit.bind(that), false);
                }
            });
        };

        submit(e) {
            e.preventDefault();
            const that = this;
            const form = e.target;
            const data = new FormData(form);
            const wrapper = form.closest(this.options.formWrapper);

            const event = this.invokeEvent(form, 'fs:before', {
                wrapper: wrapper,
                data: data,
            });
            if (event.isPrevented()) return;

            this.beforeSubmit(form);
            const messager = this.messager;
            this.request(data, function (response) {
                that.afterSubmit(form);
                if (response.status) {
                    const event = that.invokeEvent(form, 'fs:success', {
                        wrapper: wrapper,
                        data: data,
                        response: response,
                    });
                    if (!event.isPrevented()) {
                        if (typeof response.redirect !== 'undefined') {
                            window.location.href = response.redirect;
                        } else if (typeof response.output !== 'undefined') {
                            wrapper.innerHTML = response.output;
                        } else if (typeof response.messages !== 'undefined' && response.messages.length > 0) {
                            messager.message('info', response.messages);
                        } else {
                            form.reset();
                            that.beforeSubmit(form);
                            that.afterSubmit(form);
                            messager.message('info', that.options.successMessageText);
                        }
                    }
                } else {
                    const event = that.invokeEvent(form, 'fs:fail', {
                        wrapper: wrapper,
                        data: data,
                        response: response,
                    });
                    if (!event.isPrevented()) {
                        that.processErrors(response, form);
                    }
                }
                that.invokeEvent(form, 'fs:after', {
                    wrapper: wrapper,
                    data: data,
                    response: response,
                })
            }, function (error) {
                that.afterSubmit(form);
                messager.message('error', that.options.errorMessageText);
                that.invokeEvent(form, 'fs:error', {
                    wrapper: wrapper,
                    data: data,
                    error: error,
                })
            });
        };

        beforeSubmit(form) {
            const messages = form.getElementsByClassName(this.options.errorMessageClass);
            Array.from(messages).forEach(messageElement => messageElement.remove());
            const errorClass = this.options.errorClass;
            const fields = form.getElementsByClassName(errorClass);
            Array.from(fields).forEach(field => field.classList.remove(errorClass));
            const button = form.querySelector(this.options.submitBtn);
            if (button) {
                button.setAttribute('disabled', '');
            }
        };

        afterSubmit(form) {
            const button = form.querySelector(this.options.submitBtn);
            if (button) {
                button.removeAttribute('disabled');
            }
        };

        request(data, successCallback, errorCallback) {
            fetch(new Request(this.options.url, {
                method: 'post',
                credentials: 'same-origin',
                headers: Object.assign(this.options.headers, {
                    Accept: 'application/json'
                }),
                body: data
            }))
                .then(response => {
                    if (!response.ok) {
                        throw new Error();
                    }
                    return response.json();
                })
                .then(successCallback)
                .catch(errorCallback);
        };

        processErrors(response, form) {
            const that = this;
            if (Object.keys(response.errors ?? []).length > 0) {
                const fields = form.querySelectorAll('[data-field]');
                fields.forEach(field => {
                    const fieldName = field.getAttribute('data-field');
                    if (typeof response.errors[fieldName] !== 'undefined') {
                        field.classList.add(that.options.errorClass);
                        const errors = response.errors[fieldName];
                        for (const error in errors) {
                            const el = document.createElement(that.options.errorMessageElement);
                            el.className = that.options.errorMessageClass;
                            el.textContent = errors[error];
                            field.appendChild(el);
                        }
                    }
                });
            }
            if (typeof response.messages !== 'undefined' && response.messages.length > 0) {
                this.messager.message('error', response.messages);
            }
        }

        invokeEvent(target, name, data) {
            return new FormSenderEvent(target, name, data);
        }
    }

    window.FormSender = FormSender;
    window.FormSenderMessager = FormSenderMessager;
})();
