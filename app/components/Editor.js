import React from 'react';
import FilesafeEmbed from 'filesafe-embed';
import {
  EditorKit,
  EditorKitDelegate
} from 'sn-editor-kit';

// Not used directly here, but required to be imported so that it is included
// in dist file.
// Note that filesafe-embed also imports filesafe-js, but conditionally, so
// it's not included in it's own dist files.
// eslint-disable-next-line no-unused-vars
import Filesafe from 'filesafe-js';

export default class Editor extends React.Component {

  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    this.configureEditorKit();
    this.configureEditor();
  }

  configureEditorKit() {
    // EditorKit is a wrapper on top of the component manager to make it
    // easier to build editors. As such, it very general and does not know
    // how the functions are implemented, just that they are needed. It is
    // up to the Bold Editor wrapper to implement these important functions.
    const delegate = new EditorKitDelegate({
      insertRawText: (rawText) => {
        this.redactor.insertion.insertHtml(rawText);
      },
      preprocessElement: (element) => {
        // Convert inserting element to format Redactor wants.
        // This will wrap img elements, for example, in a figure element.
        // We also want to persist attributes from the inserting element.
        const cleaned = this.redactor.cleaner.input(element.outerHTML);
        const newElement = $R.dom(cleaned).nodes[0];

        for (const attribute of element.attributes) {
          newElement.setAttribute(attribute.nodeName, attribute.nodeValue);
        }

        return newElement;
      },
      insertElement: (element, inVicinityOfElement, insertionType) => {
        // When inserting elements via dom manipulation, it doesnt update the
        // source code view. So when you insert this element, open the code
        // view, and close it, the element will be gone. The only way it works
        // is if we use the proper redactor.insertion API, but I haven't found
        // a good way to use that API for inserting text at a given position.
        // There is 'insertToOffset', but where offset is the index of the
        // plaintext, but I haven't found a way to map the adjacentTo element 
        // to a plaintext offset. So for now this bug will persist.

        // insertionType can be either 'afterend' or 'child'

        if (inVicinityOfElement) {
          if (insertionType == 'afterend') {
            inVicinityOfElement.insertAdjacentElement('afterend', element);
          } else if (insertionType == 'child') {
            // inVicinityOfElement.appendChild(element) doesn't work for some
            // reason when inserting videos.
            inVicinityOfElement.after(element);
          }
        } else {
          this.redactor.insertion.insertHtml(element.outerHTML);
        }
      },
      getElementsBySelector: (selector) => {
        return this.redactor.editor.getElement().find(selector).nodes;
      },
      getCurrentLineText: () => {
        // Returns the text content of the node where the cursor currently is.
        // Typically a paragraph if no formatter, otherwise the closest 
        // formatted element, or null if there is no text content.
        const node = this.redactor.selection.getCurrent();
        return node.textContent;
      },
      getPreviousLineText: () => {
        // Returns the text content of the previous node, unless there is no
        // previous node, in which case it returns the falsy value.
        const currentElement = this.redactor.selection.getElement();
        const previousSibling = currentElement.previousSibling;
        return previousSibling && previousSibling.textContent;
      },
      replaceText: ({ regex, replacement, previousLine }) => {
        const marker = this.redactor.marker.insert('start');
        let node;
        if (previousLine) {
          node = this.redactor.selection.getElement().previousSibling;
        } else {
          node = marker.previousSibling;
        }

        // If we're searching the previous line, previousSibling may sometimes
        // be null.
        if (!node) {
          return;
        }

        let nodeText = node.textContent;
        // Remove our match from this element by replacing with empty string.
        // We'll add in our actual replacement as a new element
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
      onReceiveNote: (_note) => {
        // Empty
      },
      clearUndoHistory: () => {
        // Called when switching notes to prevent history mixup.
        $R('#editor', 'module.buffer.clear');
      },
      setEditorRawText: (rawText) => {
        // Called when the Bold Editor is loaded, when switching to a Bold
        // Editor note, or when uploading files, maybe in more places too.
        const cleaned = this.redactor.cleaner.input(rawText);
        $R('#editor', 'source.setCode', cleaned);
      }
    });

    this.editorKit = new EditorKit({
      delegate: delegate,
      mode: 'html',
      supportsFilesafe: true,
      // Redactor has its own debouncing, so we'll set ours to 0
      coallesedSavingDelay: 0
    });
  }

  async configureEditor() {
    // We need to set this as a window variable so that the filesafe plugin
    // can interact with this object passing it as an opt for some reason
    // strips any functions off the objects.
    const filesafeInstance = await this.editorKit.getFilesafe();
    window.filesafe_params = {
      embed: FilesafeEmbed,
      client: filesafeInstance
    };
    this.redactor = $R('#editor', {
      styles: true,
      toolbarFixed: true, // sticky toolbar
      tabAsSpaces: 2, // currently tab only works if you use spaces.
      tabKey: true, // explicitly set tabkey for editor use, not for focus.
      linkSize: 20000, // redactor default is 30, which truncates the link.
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
          // I think it's already cleaned so we don't need to do this.
          // let cleaned = this.redactor.cleaner.output(html);
          this.editorKit.onEditorValueChanged(html);
        },
        pasted: (_nodes) => {
          this.editorKit.onEditorPaste();
        },
        image: {
          resized: (image) => {
            // Underlying html will change, triggering save event.
            // New img dimensions need to be copied over to figure element.
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
      imageResizable: true, // requires image to be wrapped in a figure.
      imageUpload: (formData, files, _event) => {
        // Called when images are pasted from the clipboard too.
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

    // "Set the focus to the editor layer to the end of the content."
    // Doesn't work because setEditorRawText is called when loading a note and
    // it doesn't save the caret location, so focuses to beginning.
    this.redactor.editor.endFocus();
  }

  onEditorFilesDrop(files) {
    if (!this.editorKit.canUploadFiles()) {
      // Open filesafe modal
      this.redactor.plugin.filesafe.open();
      return;
    }
    for (const file of files) {
      // Observers in EditorKitInternal.js will handle successful upload
      this.editorKit.uploadJSFileObject(file).then((descriptor) => {
        if (!descriptor || !descriptor.uuid) {
          // alert("File failed to upload. Please try again");
        }
      });
    }
  }

  render() {
    return (
      <div key="editor" className={'sn-component ' + this.state.platform}>
      </div>
    );
  }
}
