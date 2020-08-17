import React from 'react';
import FilesafeEmbed from "filesafe-embed";
import {
  EditorKit,
  EditorKitDelegate
} from "sn-editor-kit";

/** 
 * Not used directly here, but required to be imported so that it is included
 * in dist file. Note thate filesafe-embed also imports filesafe-js, but only
 * conditionally, so it's not included in its own dist files.
 */
import Filesafe from "filesafe-js";

export default class Editor extends React.Component {

  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    this.configureEditorKit();
    this.configureEditor();
  }

  /**
   * Implement the functions for the EditorKit wrapper. EditorKit is just an
   * abstraction over the component manager to make it easier to build
   * editors. As such, it is very general and it is up to the Bold Editor to 
   * implement key functions.
   */
  configureEditorKit() {
    const delegate = new EditorKitDelegate({
      /**
       * Use Redactor to insert raw text at the caret (cleaned, HTML).
       * @param {string} rawText - the raw text to be inserted
       */
      insertRawText: (rawText) => {
        this.redactor.insertion.insertHtml(rawText);
      },
      /**
       * Convert inserting element to a format Redactor wants. This will wrap
       * img elements, for example, in a figure element.
       * @param {Object} element - the element to be formatted by Redactor
       * @returns {Object} - the formatted element
       */
      preprocessElement: (element) => {
        const cleaned = this.redactor.cleaner.input(element.outerHTML);
        const newElement = $R.dom(cleaned).nodes[0];

        /** We want to persist attributes from the inserting element. */
        for (const attribute of element.attributes) {
          newElement.setAttribute(attribute.nodeName, attribute.nodeValue);
        }

        return newElement;
      },
      /**
       * Insert elements using DOM manipulation.
       * @param {Object} element - the element to be inserted
       * @param {Object} inVicinityOfElement - insert near this element
       * @param {String} insertionType - insertion method at 
       * inVicinityOfElement, can be 'afterend' or 'child'
       */
      insertElement: (element, inVicinityOfElement, insertionType) => {
        /**
         * insertElement doesn't update the source code view. So when you
         * insert this element, open the code view, then close it, the element
         * will be gone. The only way it works is if we use the proper 
         * redactor.insertion API, but I haven't found a good way to use that
         * API for inserting text at a given position. There is 
         * 'insertToOffset', where offset is the index of the plaintext, but I 
         * haven't found a way to map the adjacentTo element to a plaintext
         * offset. So for now this bug will persist.
         */
        if (inVicinityOfElement) {
          if (insertionType == "afterend") {
            inVicinityOfElement.insertAdjacentElement('afterend', element);
          } else if (insertionType == "child") {
            /** 
             * inVicinityOfElement.appendChild(element) doesn't work for some
             * reason when inserting videos. 
             */
            inVicinityOfElement.after(element);
          }
        } else {
          this.redactor.insertion.insertHtml(element.outerHTML);
        }
      },
      /**
       * Return all the nodes that match a given selector. For example, 
       * *[fscollapsable] returns all nodes with attribute 'fscollapsable'
       * @param {String} selector - the testing function or selector
       * @returns {Object} - the matching nodes
       */
      getElementsBySelector: (selector) => {
        return this.redactor.editor.getElement().find(selector).nodes;
      },
      /**
       * Return the text content of the node where the caret is currently
       * located. Typically a paragraph if no formatter, otherwise the closest
       * formatted element, or null if there is no text content.
       * @returns {String} - the text content of the node
       */
      getCurrentLineText: () => {
        const node = this.redactor.selection.getCurrent();
        return node.textContent;
      },
      /**
       * Return the text content of the previous node where the caret is 
       * currently located. If there is no previous node, it returns the falsy
       * value.
       * @returns {Object} - the text content of the previous node
       */
      getPreviousLineText: () => {
        const currentElement = this.redactor.selection.getElement();
        const previousSibling = currentElement.previousSibling;
        return previousSibling && previousSibling.textContent;
      },
      /**
       * Replace matching text with new text.
       * @param {Object} object - The matching regex, replacement text, and
       * boolean for if we are dealing with the previous line.
       */
      replaceText: ({
        regex,
        replacement,
        previousLine
      }) => {
        const marker = this.redactor.marker.insert('start');
        let node;
        if (previousLine) {
          node = this.redactor.selection.getElement().previousSibling;
        } else {
          node = marker.previousSibling;
        }

        /**
         * If we're searching the previous line, previousSibling may sometimes
         * be null.
         */
        if (!node) {
          return;
        }

        let nodeText = node.textContent;
        /** 
         * Remove our match from this element by replacing with empty string.
         * We'll add in our actual replacement as a new element.
         */
        nodeText = nodeText.replace(/&nbsp;/, ' ');
        nodeText = nodeText.replace(regex, '').replace(/\s$/, '').trim();
        if (nodeText.length == 0) {
          node.remove();
        } else {
          node.textContent = nodeText;
        }

        this.redactor.insertion.insertHtml(replacement, 'start');
        this.redactor.selection.restoreMarkers();
      },
      onReceiveNote: (note) => {
        /** Empty */
      },
      /**
       * Called when switching notes to prevent history mixup.
       */
      clearUndoHistory: () => {
        $R('#editor', 'module.buffer.clear');
      },
      /** 
       * Reset the editor to text that will be inserted. Called when the Bold
       * Editor is loaded, when switching to a Bold Editor note, or when 
       * uploading files, maybe in more places too.
       * @param {String} rawText - the text to replace current editor contents
       */
      setEditorRawText: (rawText) => {
        const cleaned = this.redactor.cleaner.input(rawText);
        $R('#editor', 'source.setCode', cleaned);
      }
    });

    this.editorKit = new EditorKit({
      delegate: delegate,
      mode: 'html',
      supportsFilesafe: true,
      /** Redactor has its own debouncing, so we'll set ours to 0 */
      coallesedSavingDelay: 0
    })
  }

  async configureEditor() {
    /**
     * We need to set this as a window variable so that the filesafe plugin
     * can interact with this object passing it as an opt for some reason
     * strips any functions off the objects.
     */
    const filesafeInstance = await this.editorKit.getFilesafe();
    window.filesafe_params = {
      embed: FilesafeEmbed,
      client: filesafeInstance
    };
    this.redactor = $R('#editor', {
      styles: true,
      toolbarFixed: true,
      /** Sticky toolbar. */
      tabAsSpaces: 2,
      /** Currently tab only works if you use spaces. */
      tabKey: true,
      /** Explicitly set tabkey for editor use, not for focus. */
      linkSize: 20000,
      /** Redactor default is 30, which truncates the link. */
      buttonsAdd: ['filesafe'],
      buttons: [
        'bold', 'italic', 'underline', 'deleted', 'format', 'fontsize',
        'fontfamily', 'fontcolor', 'filesafe', 'link', 'lists', 'alignment',
        'line', 'redo', 'undo', 'indent', 'outdent', 'textdirection', 'html'
      ],
      plugins: [
        'filesafe', 'fontsize', 'fontfamily', 'fontcolor', 'alignment',
        'table', 'inlinestyle', 'textdirection'
      ],
      fontfamily: [
        'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Trebuchet MS',
        'Monospace'
      ],
      callbacks: {
        changed: (html) => {
          /** I think it's already cleaned so we don't need to do this. */
          /** let cleaned = this.redactor.cleaner.output(html); */
          this.editorKit.onEditorValueChanged(html);
        },
        pasted: (nodes) => {
          this.editorKit.onEditorPaste();
        },
        image: {
          resized: (image) => {
            /**
             * Underlying html will change, triggering save event. New img
             * dimensions need to be copied over to figure element.
             */
            const img = image.nodes[0];
            const fig = img.parentNode;
            fig.setAttribute('width', img.getAttribute('width'));
            fig.setAttribute('height', img.getAttribute('height'));
          }
        }
      },
      imageEditable: false,
      imageCaption: false,
      imageLink: false,
      imageResizable: true,
      /** Requires image to be wrapped in a figure. */
      imageUpload: (formData, files, event) => {
        /** Called when images are pasted from the clipboard too. */
        this.onEditorFilesDrop(files);
      }
    });

    this.redactor.editor.getElement().on('keyup.textsearcher', (event) => {
      const key = event.which;
      this.editorKit.onEditorKeyUp({
        key,
        isSpace: key == this.redactor.keycodes.SPACE,
        isEnter: key == this.redactor.keycodes.ENTER
      });
    });
  }

  onEditorFilesDrop(files) {
    if (!this.editorKit.canUploadFiles()) {
      /** Open FileSafe modal. */
      this.redactor.plugin.filesafe.open();
      return;
    }
    for (const file of files) {
      /** Observers in EditorKitInternal.js will handle successful upload */
      this.editorKit.uploadJSFileObject(file).then((descriptor) => {
        if (!descriptor || !descriptor.uuid) {
          /** alert("File failed to upload. Please try again"); */
        }
      })
    }
  }

  render() {
    return (
      <div key="editor" className={"sn-component " + this.state.platform}>
      </div>
    )
  }
}
