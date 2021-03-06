/*
 * Copyright 2007-2013 Charles du Jeu - Abstrium SAS <team (at) pyd.io>
 * This file is part of Pydio.
 *
 * Pydio is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Pydio is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Pydio.  If not, see <http://www.gnu.org/licenses/>.
 *
 * The latest code can be found at <http://pyd.io/>.
 */
(function(global) {

    var MessagesConsumerMixin = {
        contextTypes: {
            messages:React.PropTypes.object,
            getMessage:React.PropTypes.func
        }
    };

    var MessagesProviderMixin = {

        childContextTypes: {
            messages:React.PropTypes.object,
            getMessage:React.PropTypes.func
        },

        getChildContext: function() {
            var messages = this.props.pydio.MessageHash;
            return {
                messages: messages,
                getMessage: function(messageId, namespace='share_center'){
                    try{
                        return messages[namespace + (namespace?".":"") + messageId] || messageId;
                    }catch(e){
                        return messageId;
                    }
                }
            };
        }

    };


    var MainPanel = React.createClass({

        mixins:[MessagesProviderMixin],

        propTypes: {
            closeAjxpDialog: React.PropTypes.func.isRequired,
            pydio:React.PropTypes.instanceOf(Pydio).isRequired,
            selection:React.PropTypes.instanceOf(PydioDataModel).isRequired
        },

        refreshDialogPosition:function(){
            global.pydio.UI.modal.refreshDialogPosition();
        },

        modelUpdated: function(eventData){
            if(this.isMounted()){
                this.setState({
                    status: eventData.status,
                    model:eventData.model
                }, function(){
                    this.refreshDialogPosition();
                }.bind(this));
                if(eventData.status == "saved"){
                    this.props.pydio.fireNodeRefresh(this.props.selection.getUniqueNode());
                }
            }
        },

        getInitialState: function(){
            return {
                status: 'idle',
                mailerData: false,
                model: new ReactModel.Share(this.props.pydio, this.props.selection)
            };
        },

        showMailer:function(subject, message, users = []){
            if(ReactModel.Share.forceMailerOldSchool()){
                subject = encodeURIComponent(subject);
                message = encodeURIComponent(message);
                global.location.href = "mailto:custom-email@domain.com?Subject="+subject+"&Body="+message;
                return;
            }
            global.ResourcesManager.loadClassesAndApply(['PydioMailer'], function(){
                this.setState({
                    mailerData: {
                        subject:subject,
                        message:message,
                        users:users
                    }
                });
            }.bind(this));
        },

        dismissMailer:function(){
            this.setState({mailerData:false});
        },

        componentDidMount: function(){
            this.state.model.observe("status_changed", this.modelUpdated);
        },

        clicked: function(){
            this.props.closeAjxpDialog();
        },

        getMessage: function(key, namespace = 'share_center'){
            return this.props.pydio.MessageHash[namespace + (namespace?'.':'') + key];
        },

        render: function(){
            var model = this.state.model;
            var panels = [];
            var showMailer = ReactModel.Share.mailerActive() ? this.showMailer : null;
            var auth = ReactModel.Share.getAuthorizations(this.props.pydio);
            if((model.getNode().isLeaf() && auth.file_public_link) || (!model.getNode().isLeaf() && auth.folder_public_link)){
                var publicLinks = model.getPublicLinks();
                if(publicLinks.length){
                    var linkData = publicLinks[0];
                }
                panels.push(
                    <ReactMUI.Tab key="public-link" label={this.getMessage(121) + (model.hasPublicLink()?' (' + this.getMessage(178) + ')':'')}>
                        <PublicLinkPanel
                            showMailer={showMailer}
                            linkData={linkData}
                            pydio={this.props.pydio}
                            shareModel={model}
                            authorizations={auth}
                        />
                    </ReactMUI.Tab>
                );
            }
            if( (model.getNode().isLeaf() && auth.file_workspaces) || (!model.getNode().isLeaf() && auth.folder_workspaces)){
                var users = model.getSharedUsers();
                var ocsUsers = model.getOcsLinks();
                var totalUsers = users.length + ocsUsers.length;
                panels.push(
                    <ReactMUI.Tab key="target-users" label={this.getMessage(249, '') + (totalUsers?' ('+totalUsers+')':'')}>
                        <UsersPanel
                            showMailer={showMailer}
                            shareModel={model}
                        />
                    </ReactMUI.Tab>
                );
            }
            if(panels.length > 0){
                panels.push(
                    <ReactMUI.Tab  key="share-permissions" label={this.getMessage(486, '')}>
                        <AdvancedPanel
                            showMailer={showMailer}
                            pydio={this.props.pydio}
                            shareModel={model}
                        />
                    </ReactMUI.Tab>
                );
            }
            if(this.state.mailerData){
                var mailer = (<PydioMailer.Pane
                    {...this.state.mailerData}
                    onDismiss={this.dismissMailer}
                    overlay={true}
                    className="share-center-mailer"
                    panelTitle={this.props.pydio.MessageHash["share_center.45"]}
                />);
            }

            return(
                <div style={{width:420}}>
                    <HeaderPanel {...this.props} shareModel={this.state.model}/>
                    <ReactMUI.Tabs onChange={this.refreshDialogPosition}>{panels}</ReactMUI.Tabs>
                    <ButtonsPanel {...this.props} shareModel={this.state.model} onClick={this.clicked}/>
                    {mailer}
                </div>
            );
        }

    });

    var HeaderPanel = React.createClass({
        mixins:[MessagesConsumerMixin],
        render: function(){
            return (
                <div className="headerPanel">
                    <div
                        style={{fontSize: 24, color:'white', padding:'20px 16px 14px'}}
                    >{this.context.getMessage('44').replace('%s', PathUtils.getBasename(this.props.shareModel.getNode().getPath()))}</div>
                </div>
            );
        }
    });

    var ButtonsPanel = React.createClass({

        mixins:[MessagesConsumerMixin],

        propTypes: {
            onClick: React.PropTypes.func.isRequired
        },
        triggerModelSave: function(){
            this.props.shareModel.save();
        },
        triggerModelRevert:function(){
            this.props.shareModel.revertChanges();
        },
        render: function(){
            if(this.props.shareModel.getStatus() == 'modified'){
                return (
                    <div style={{padding:16,textAlign:'right'}}>
                        <a className="revert-button" onClick={this.triggerModelRevert}>{this.context.getMessage('179')}</a>
                        <ReactMUI.FlatButton secondary={true} label={this.context.getMessage('53', '')} onClick={this.triggerModelSave}/>
                        <ReactMUI.FlatButton secondary={false} label={this.context.getMessage('86', '')} onClick={this.props.onClick}/>
                    </div>
                );
            }else{
                return (
                    <div style={{padding:16,textAlign:'right'}}>
                        <ReactMUI.FlatButton secondary={false} label={this.context.getMessage('86', '')} onClick={this.props.onClick}/>
                    </div>
                );
            }
        }
    });

    /**************************/
    /* USERS PANEL
    /**************************/
    var UsersPanel = React.createClass({

        mixins:[MessagesConsumerMixin],

        propTypes:{
            shareModel:React.PropTypes.instanceOf(ReactModel.Share),
            showMailer:React.PropTypes.func
        },
        onUserUpdate: function(operation, userId, userData){
            this.props.shareModel.updateSharedUser(operation, userId, userData);
        },
        onSaveSelection:function(){
            var label = window.prompt(this.context.getMessage(510, ''));
            if(!label) return;
            this.props.shareModel.saveSelectionAsTeam(label);
        },
        valueSelected: function(id, label, type){
            var newEntry = {
                ID: id,
                RIGHT:'r',
                LABEL: label,
                TYPE:type
            };
            this.props.shareModel.updateSharedUser('add', newEntry.ID, newEntry);
        },
        completerRenderSuggestion: function(userObject){
            return (
                <UserBadge
                    label={userObject.getExtendedLabel() || userObject.getLabel()}
                    avatar={userObject.getAvatar()}
                    type={userObject.getGroup() ? 'group' : (userObject.getTemporary()?'temporary' : (userObject.getExternal()?'tmp_user':'user'))}
                />
            );
        },

        sendInvitations:function(userObjects){
            var mailData = this.props.shareModel.prepareEmail("repository");
            this.props.showMailer(mailData.subject, mailData.message, userObjects);
        },

        render: function(){
            var currentUsers = this.props.shareModel.getSharedUsers();
            const excludes = currentUsers.map(function(u){return u.ID});
            return (
                <div style={{padding:'30px 20px 10px'}}>
                    <UsersCompleter.Input
                        fieldLabel={this.context.getMessage('34')}
                        renderSuggestion={this.completerRenderSuggestion}
                        onValueSelected={this.valueSelected}
                        excludes={excludes}
                    />
                    <SharedUsersBox
                        users={currentUsers}
                        userObjects={this.props.shareModel.getSharedUsersAsObjects()}
                        sendInvitations={this.props.showMailer ? this.sendInvitations : null}
                        onUserUpdate={this.onUserUpdate}
                        saveSelectionAsTeam={PydioUsers.Client.saveSelectionSupported()?this.onSaveSelection:null}
                    />
                    <RemoteUsers
                        shareModel={this.props.shareModel}
                        onUserUpdate={this.onUserUpdate}
                    />
                </div>
            );
        }
    });

    var UserBadge = React.createClass({
        propTypes: {
            label: React.PropTypes.string,
            avatar: React.PropTypes.string,
            type:React.PropTypes.string,
            menus: React.PropTypes.object
        },
        getInitialState(){
            return {showMenu:false};
        },
        showMenu: function () {
            this.setState({showMenu: true});
        },
        /****************************/
        /* WARNING: PROTOTYPE CODE
         */
        hideMenu: function(event){
            if(event && event.target.up('.mui-icon-button')){
                return;
            }
            this.setState({showMenu: false});
        },
        componentDidMount: function(){
            this._observer = this.hideMenu.bind(this);
            document.observe('click', this._observer);
        },
        componentWillUnmount: function(){
            document.stopObserving('click', this._observer);
        },
        /*
        /* END PROTOTYPE CODE
        /***************************/

        menuClicked:function(event, index, menuItem){
            if(menuItem.payload){
                menuItem.payload();
            }
            this.hideMenu();
        },
        renderMenu: function(){
            if (!this.props.menus) {
                return null;
            }
            var menuAnchor = <ReactMUI.IconButton iconClassName="icon-ellipsis-vertical" onClick={this.showMenu}/>;
            if(this.state.showMenu) {
                const menuItems = this.props.menus.map(function(m){
                    var text = m.text;
                    if(m.checked){
                        text = <span><span className="icon-check"/>{m.text}</span>;
                    }
                    return {text:text, payload:m.callback};
                });
                var menuBox = <ReactMUI.Menu onItemClick={this.menuClicked} zDepth={0} menuItems={menuItems}/>;
            }
            return (
                <div className="user-badge-menu-box">
                    {menuAnchor}
                    {menuBox}
                </div>
            );
        },

        render: function () {
            var avatar;
            /*
            if (this.props.avatar) {
                avatar = (
                    <span className="user-badge-avatar">
                        <img src="" width={40} height={40}
                             src={global.pydio.Parameters.get('ajxpServerAccess')+'&get_action=get_binary_param&binary_id='+this.props.avatar}/>
                    </span>
                );
            }else{
                avatar = <span className="icon-user"/>;
            }*/
            if(this.props.type == 'group') {
                avatar = <span className="avatar icon-group"/>;
            }else if(this.props.type == 'temporary') {
                avatar = <span className="avatar icon-plus"/>;
            }else if(this.props.type == 'remote_user'){
                avatar = <span className="avatar icon-cloud"/>;
            }else{
                avatar = <span className="avatar icon-user"/>;
            }
            var menu = this.renderMenu();
            return (
                <div className={"user-badge user-type-" + this.props.type}>
                    {avatar}
                    <span className="user-badge-label">{this.props.label}</span>
                    {this.props.children}
                    {menu}
                </div>
            );
        }
    });

    var SharedUsersBox = React.createClass({

        mixins:[MessagesConsumerMixin],

        propTypes: {
            users:React.PropTypes.array.isRequired,
            userObjects:React.PropTypes.object.isRequired,
            onUserUpdate:React.PropTypes.func.isRequired,
            saveSelectionAsTeam:React.PropTypes.func,
            sendInvitations:React.PropTypes.func
        },
        sendInvitationToAllUsers:function(){
            this.props.sendInvitations(this.props.userObjects);
        },
        clearAllUsers:function(){
            this.props.users.map(function(entry){
                this.props.onUserUpdate('remove', entry.ID, entry);
            }.bind(this));
        },
        render: function(){
            // sort by group/user then by ID;
            const userEntries = this.props.users.sort(function(a,b) {
                return (b.TYPE == "group") ? 1 : ((a.TYPE == "group") ? -1 : (a.ID > b.ID) ? 1 : ((b.ID > a.ID) ? -1 : 0));
            } ).map(function(u){
                return <SharedUserEntry
                    userEntry={u}
                    userObject={this.props.userObjects[u.ID]}
                    key={u.ID}
                    shareModel={this.props.shareModel}
                    onUserUpdate={this.props.onUserUpdate}
                    sendInvitations={this.props.sendInvitations}
                />
            }.bind(this));
            var actionLinks = [];
            if(this.props.users.length){
                actionLinks.push(<a key="clear" onClick={this.clearAllUsers}>{this.context.getMessage('180')}</a>);
            }
            if(this.props.sendInvitations && this.props.users.length){
                actionLinks.push(<a key="invite" onClick={this.sendInvitationToAllUsers}>{this.context.getMessage('45')}</a>);
            }
            if(this.props.saveSelectionAsTeam && this.props.users.length > 1){
                actionLinks.push(<a key="team" onClick={this.props.saveSelectionAsTeam}>{this.context.getMessage('509', '')}</a>);
            }
            if(actionLinks.length){
                var linkActions = <div className="additional-actions-links">{actionLinks}</div>;
            }
            var rwHeader;
            if(this.props.users.length){
                rwHeader = (
                    <div>
                        <div className="shared-users-rights-header">
                            <span className="read">{this.context.getMessage('361', '')}</span>
                            <span className="read">{this.context.getMessage('181')}</span>
                        </div>
                    </div>
                );
            }else{
                rwHeader = (
                    <div className="section-legend" style={{padding:10}}>{this.context.getMessage('182')}</div>
                );
            }
            return (
                <div style={{marginTop: 10}}>
                    {rwHeader}
                    <div>{userEntries}</div>
                    {linkActions}
                </div>
            );
        }
    });

    var SharedUserEntry = React.createClass({

        mixins:[MessagesConsumerMixin],

        propTypes: {
            userEntry:React.PropTypes.object.isRequired,
            userObject:React.PropTypes.instanceOf(PydioUsers.User).isRequired,
            onUserUpdate:React.PropTypes.func.isRequired,
            sendInvitations:React.PropTypes.func
        },
        onRemove:function(){
            this.props.onUserUpdate('remove', this.props.userEntry.ID, this.props.userEntry);
        },
        onToggleWatch:function(){
            this.props.onUserUpdate('update_right', this.props.userEntry.ID, {right:'watch', add:!this.props.userEntry['WATCH']});
        },
        onInvite:function(){
            var targets = {};
            targets[this.props.userObject.getId()] = this.props.userObject;
            this.props.sendInvitations(targets);
        },
        onUpdateRight:function(event){
            var target = event.target;
            this.props.onUserUpdate('update_right', this.props.userEntry.ID, {right:target.name, add:target.checked});
        },
        render: function(){
            var menuItems = [];
            if(this.props.userEntry.TYPE != 'group'){
                menuItems.push({
                    text:this.context.getMessage('183'),
                    callback:this.onToggleWatch,
                    checked:this.props.userEntry.WATCH
                });
                if(this.props.sendInvitations){
                    menuItems.push({
                        text:this.context.getMessage('45'),
                        callback:this.onInvite
                    });
                }
            }
            menuItems.push({
                text:this.context.getMessage('257', ''),
                callback:this.onRemove
            });
            return (
                <UserBadge
                    label={this.props.userEntry.LABEL || this.props.userEntry.ID }
                    avatar={this.props.userEntry.AVATAR}
                    type={this.props.userEntry.TYPE}
                    menus={menuItems}
                >
                    <span className="user-badge-rights-container">
                        <input type="checkbox" name="read" checked={this.props.userEntry.RIGHT.indexOf('r') !== -1} onChange={this.onUpdateRight}/>
                        <input type="checkbox" name="write" checked={this.props.userEntry.RIGHT.indexOf('w') !== -1} onChange={this.onUpdateRight}/>
                    </span>
                </UserBadge>
            );
        }
    });

    var RemoteUsers = React.createClass({

        mixins:[MessagesConsumerMixin],

        propTypes:{
            shareModel: React.PropTypes.instanceOf(ReactModel.Share),
            onUserUpdate:React.PropTypes.func.isRequired
        },

        getInitialState: function(){
            return {addDisabled: true};
        },

        addUser:function(){
            var h = this.refs["host"].getValue();
            var u = this.refs["user"].getValue();
            this.props.shareModel.createRemoteLink(h, u);
        },

        removeUser: function(linkId){
            this.props.shareModel.removeRemoteLink(linkId);
        },

        monitorInput:function(){
            var h = this.refs["host"].getValue();
            var u = this.refs["user"].getValue();
            this.setState({addDisabled:!(h && u)});
        },

        render: function(){

            var inv = this.props.shareModel.getOcsLinks().map(function(link){
                return (
                    <RemoteUserEntry
                        shareModel={this.props.shareModel}
                        linkData={link}
                        onRemoveUser={this.removeUser}
                        onUserUpdate={this.props.onUserUpdate}
                    />
                );
            }.bind(this));
            return (
                <div>
                    <h3>{this.context.getMessage('207')}</h3>
                    <div className="section-legend">{this.context.getMessage('208')}</div>
                    <div className="remote-users-add reset-pydio-forms">
                        <ReactMUI.TextField className="host" ref="host" floatingLabelText={this.context.getMessage('209')} onChange={this.monitorInput}/>
                        <ReactMUI.TextField className="user" ref="user" type="text" floatingLabelText={this.context.getMessage('210')} onChange={this.monitorInput}/>
                        <ReactMUI.IconButton tooltip={this.context.getMessage('45')} iconClassName="icon-plus-sign" onClick={this.addUser} disabled={this.state.addDisabled}/>
                    </div>
                    <div>{inv}</div>
                </div>
            );

        }
    });

    var RemoteUserEntry = React.createClass({

        mixins:[MessagesConsumerMixin],

        propTypes:{
            shareModel:React.PropTypes.instanceOf(ReactModel.Share),
            linkData:React.PropTypes.object.isRequired,
            onRemoveUser:React.PropTypes.func.isRequired,
            onUserUpdate:React.PropTypes.func.isRequired
        },

        getInitialState(){
            return {
                internalUser: this.props.shareModel.getSharedUser(this.props.linkData['internal_user_id'])
            };
        },

        componentWillReceiveProps(newProps, oldProps){
            this.setState({
                internalUser:newProps.shareModel.getSharedUser(newProps.linkData['internal_user_id'])
            });
        },

        buildLabel: function(){
            var link = this.props.linkData;

            var status;
            if(!link.invitation){
                status = '214';
            }else {
                if(link.invitation.STATUS == 1){
                    status = '211';
                }else if(link.invitation.STATUS == 2){
                    status = '212';
                }else if(link.invitation.STATUS == 4){
                    status = '213';
                }
            }
            status = this.context.getMessage(status);

            var host = link.HOST || link.invitation.HOST;
            var user = link.USER || link.invitation.USER;
            return user + " @ " + host + " (" + status + ")";
        },

        removeUser: function(){
            this.props.onRemoveUser(this.props.linkData['hash']);
        },

        onUpdateRight:function(event){
            var target = event.target;
            this.props.onUserUpdate('update_right', this.state.internalUser.ID, {right:target.name, add:target.checked});
        },

        render: function(){
            var menuItems = [{
                text:this.context.getMessage('257', ''),
                callback:this.removeUser
            }];
            return (
                <UserBadge
                    label={this.buildLabel()}
                    avatar={null}
                    type={"remote_user"}
                    menus={menuItems}
                >
                    <span className="user-badge-rights-container">
                        <input type="checkbox" name="read" checked={this.state.internalUser.RIGHT.indexOf('r') !== -1} onChange={this.onUpdateRight}/>
                        <input type="checkbox" name="write" checked={this.state.internalUser.RIGHT.indexOf('w') !== -1} onChange={this.onUpdateRight}/>
                    </span>
                </UserBadge>
            );
        }

    });

    /**************************/
    /* PUBLIC LINK PANEL
     /**************************/
    var PublicLinkPanel = React.createClass({

        mixins:[MessagesConsumerMixin],

        propTypes: {
            linkData:React.PropTypes.object,
            pydio:React.PropTypes.instanceOf(Pydio),
            shareModel: React.PropTypes.instanceOf(ReactModel.Share),
            authorizations: React.PropTypes.object,
            showMailer:React.PropTypes.func
        },

        toggleLink: function(event){
            this.props.shareModel.togglePublicLink();
        },

        render: function(){

            var publicLinkPanes;
            if(this.props.linkData){
                publicLinkPanes = [
                    <PublicLinkField
                        showMailer={this.props.showMailer}
                        linkData={this.props.linkData}
                        shareModel={this.props.shareModel}
                        editAllowed={this.props.authorizations.editable_hash}
                        key="public-link"
                    />,
                    <PublicLinkPermissions
                        linkData={this.props.linkData}
                        shareModel={this.props.shareModel}
                        key="public-perm" />,
                    <PublicLinkSecureOptions
                        linkData={this.props.linkData}
                        shareModel={this.props.shareModel}
                        key="public-secure"
                    />
                ];
            }else{
                publicLinkPanes = [
                    <div className="section-legend" style={{marginTop:20}}>{this.context.getMessage('190')}</div>
                ];
            }

            return (
                <div style={{padding:16}} className="reset-pydio-forms">
                    <ReactMUI.Checkbox onCheck={this.toggleLink} checked={!!this.props.linkData} label={this.context.getMessage('189')}/>
                    {publicLinkPanes}
                </div>
            );
        }
    });

    var PublicLinkField = React.createClass({

        mixins:[MessagesConsumerMixin],

        propTypes: {
            linkData:React.PropTypes.object.isRequired,
            shareModel: React.PropTypes.instanceOf(ReactModel.Share),
            editAllowed: React.PropTypes.bool,
            onChange: React.PropTypes.func,
            showMailer:React.PropTypes.func
        },
        getInitialState: function(){
            return {editLink: false, copyMessage:''};
        },
        toggleEditMode: function(){
            if(this.state.editLink && this.state.customLink){
                this.props.shareModel.updateCustomLink(this.props.linkData.hash, this.state.customLink);
            }
            this.setState({editLink: !this.state.editLink});
        },
        changeLink:function(event){
            this.setState({customLink: event.target.value});
        },
        clearCopyMessage:function(){
            global.setTimeout(function(){
                this.setState({copyMessage:''});
            }.bind(this), 5000);
        },

        attachClipboard: function(){
            this.detachClipboard();
            if(this.refs['copy-button']){
                this._clip = new Clipboard(this.refs['copy-button'].getDOMNode(), {
                    text: function(trigger) {
                        return this.props.linkData['public_link'];
                    }.bind(this)
                });
                this._clip.on('success', function(){
                    this.setState({copyMessage:this.context.getMessage('192')}, this.clearCopyMessage);
                }.bind(this));
                this._clip.on('error', function(){
                    var copyMessage;
                    if( global.navigator.platform.indexOf("Mac") === 0 ){
                        copyMessage = global.pydio.MessageHash['share_center.144'];
                    }else{
                        copyMessage = global.pydio.MessageHash['share_center.143'];
                    }
                    this.refs['public-link-field'].focus();
                    this.setState({copyMessage:copyMessage}, this.clearCopyMessage);
                }.bind(this));
            }
        },
        detachClipboard: function(){
            if(this._clip){
                this._clip.destroy();
            }
        },

        componentDidUpdate: function(prevProps, prevState){
            this.attachClipboard();
        },

        componentDidMount: function(){
            this.attachClipboard();
        },

        componentWillUnmount: function(){
            this.detachClipboard();
        },

        openMailer: function(){
            var mailData = this.props.shareModel.prepareEmail("link", this.props.linkData.hash);
            this.props.showMailer(mailData.subject, mailData.message, []);
        },

        render: function(){
            var publicLink = this.props.linkData['public_link'];
            var editAllowed = this.props.editAllowed && !this.props.linkData['hash_is_shorten'];
            if(this.state.editLink && editAllowed){
                return (
                    <div className="public-link-container edit-link">
                        <span>{publicLink.split('://')[0]}://[..]/{PathUtils.getBasename(PathUtils.getDirname(publicLink)) + '/'}</span>
                        <ReactMUI.TextField onChange={this.changeLink} value={this.state.customLink || this.props.linkData['hash']}/>
                        <ReactMUI.RaisedButton label="Ok" onClick={this.toggleEditMode}/>
                        <div className="section-legend">{this.context.getMessage('194')}</div>
                    </div>
                );
            }else{
                var copyButton = <span ref="copy-button" className="copy-link-button icon-paste" title={this.context.getMessage('191')}/>;
                var setHtml = function(){
                    return {__html:this.state.copyMessage};
                }.bind(this);
                var focus = function(e){
                    e.target.select();
                };
                var actionLinks = [];
                if(this.props.showMailer){
                    actionLinks.push(<a key="invitation" onClick={this.openMailer}>{this.context.getMessage('45')}</a>);
                }
                if(editAllowed){
                    actionLinks.push(<a key="customize" onClick={this.toggleEditMode}>{this.context.getMessage('193')}</a>);
                }
                if(actionLinks.length){
                    actionLinks = (
                        <div className="additional-actions-links">{actionLinks}</div>
                    ) ;
                }else{
                    actionLinks = null;
                }
                return (
                    <div className="public-link-container">
                        <ReactMUI.TextField
                            className="public-link"
                            type="text"
                            name="Link"
                            ref="public-link-field"
                            value={publicLink}
                            onFocus={focus}
                        /> {copyButton}
                        <div style={{textAlign:'center'}} className="section-legend" dangerouslySetInnerHTML={setHtml()}/>
                        {actionLinks}
                    </div>
                );
            }
        }
    });

    var PublicLinkPermissions = React.createClass({

        mixins:[MessagesConsumerMixin],

        propTypes: {
            linkData: React.PropTypes.object.isRequired,
            shareModel: React.PropTypes.instanceOf(ReactModel.Share)
        },

        changePermission: function(event){
            var name = event.target.name;
            var checked = event.target.checked;
            this.props.shareModel.setPublicLinkPermission(this.props.linkData.hash, name, checked);
        },

        render: function(){
            var linkId = this.props.linkData.hash;
            var perms = [], previewWarning;
            perms.push({NAME:'read',LABEL:this.context.getMessage('72')});
            perms.push({NAME:'download', LABEL:this.context.getMessage('73')});
            if(!this.props.shareModel.getNode().isLeaf()){
                perms.push({NAME:'write', LABEL:this.context.getMessage('74')});
            }
            if(this.props.shareModel.isPublicLinkPreviewDisabled() && this.props.shareModel.getPublicLinkPermission(linkId, 'read')){
                previewWarning = <div>{this.context.getMessage('195')}</div>;
            }
            return (
                <div>
                    <h3>{this.context.getMessage('71')}</h3>
                    <div className="section-legend">{this.context.getMessage('70r')}</div>
                    <div style={{margin:'10px 0 20px'}}>
                        {perms.map(function(p){
                            return (
                                <div style={{display:'inline-block',width:'30%'}}>
                                    <ReactMUI.Checkbox
                                        type="checkbox"
                                        name={p.NAME}
                                        label={p.LABEL}
                                        onCheck={this.changePermission}
                                        checked={this.props.shareModel.getPublicLinkPermission(linkId, p.NAME)}
                                    />
                                </div>
                            );
                        }.bind(this))}
                        {previewWarning}
                    </div>
                </div>
            );
        }
    });

    var PublicLinkSecureOptions = React.createClass({

        mixins:[MessagesConsumerMixin],

        propTypes: {
            linkData: React.PropTypes.object.isRequired,
            shareModel: React.PropTypes.instanceOf(ReactModel.Share)
        },

        updateDLExpirationField: function(event){
            var newValue = event.currentTarget.getValue();
            this.props.shareModel.setExpirationFor(this.props.linkData.hash, "downloads", newValue);
        },

        updateDaysExpirationField: function(event){
            var newValue = event.currentTarget.getValue();
            this.props.shareModel.setExpirationFor(this.props.linkData.hash, "days", newValue);
        },

        resetPassword: function(){
            this.props.shareModel.resetPassword(this.props.linkData.hash);
        },

        updatePassword: function(newValue, oldValue){
            //var newValue = event.currentTarget.getValue();
            this.props.shareModel.updatePassword(this.props.linkData.hash, newValue);
        },

        render: function(){
            var linkId = this.props.linkData.hash;
            var passwordField;
            if(this.props.shareModel.hasHiddenPassword(linkId)){
                var resetPassword = (
                    <ReactMUI.FlatButton secondary={true} onClick={this.resetPassword} label={this.context.getMessage('174')}/>
                );
                passwordField = (
                    <ReactMUI.TextField
                        floatingLabelText={this.context.getMessage('23')}
                        disabled={true}
                        value={'********'}
                        onChange={this.updatePassword}
                    />
                );
            }else{
                passwordField = (
                    <PydioForm.ValidPassword
                        attributes={{label:this.context.getMessage('23')}}
                        value={this.props.shareModel.getPassword(linkId)}
                        onChange={this.updatePassword}
                    />
                );
            }
            return (
                <div>
                    <h3>{this.context.getMessage('196')}</h3>
                    <div className="section-legend">{this.context.getMessage('24')}</div>
                    <div className="password-container">
                        <div style={{width:'50%', display:'inline-block'}}>
                            {passwordField}
                        </div>
                        <div style={{width:'50%', display:'inline-block'}}>
                            {resetPassword}
                        </div>
                    </div>
                    <div className="expires">
                        <div style={{width:'50%', display:'inline-block'}}>
                            <ReactMUI.TextField
                                   floatingLabelText={this.context.getMessage('21')}
                                   value={this.props.shareModel.getExpirationFor(linkId, 'days') === 0 ? "" : this.props.shareModel.getExpirationFor(linkId, 'days')}
                                   onChange={this.updateDaysExpirationField}/>
                            </div>
                        <div style={{width:'50%', display:'inline-block'}}>
                            <ReactMUI.TextField
                               floatingLabelText={this.context.getMessage('22')}
                               value={this.props.shareModel.getExpirationFor(linkId, 'downloads') === 0 ? "" : this.props.shareModel.getExpirationFor(linkId, 'downloads')}
                               onChange={this.updateDLExpirationField}
                            />
                        </div>
                    </div>
                </div>
            );
        }
    });

    /**************************/
    /* ADVANCED PANEL
    /**************************/
    var AdvancedPanel = React.createClass({
        propTypes:{
            pydio:React.PropTypes.instanceOf(Pydio),
            shareModel:React.PropTypes.instanceOf(ReactModel.Share)
        },
        render: function(){

            var layoutData = ReactModel.Share.compileLayoutData(this.props.pydio, this.props.shareModel.getNode());
            if(!this.props.shareModel.getNode().isLeaf() && layoutData.length > 1 && this.props.shareModel.hasPublicLink()){
                var layoutPane = <PublicLinkTemplate {...this.props} linkData={this.props.shareModel.getPublicLinks()[0]} layoutData={layoutData}/>;
            }

            return (
                <div style={{padding:16}}>
                    <LabelDescriptionPanel {...this.props}/>
                    <NotificationPanel {...this.props}/>
                    {layoutPane}
                    <VisibilityPanel  {...this.props}/>
                </div>
            );
        }
    });

    var LabelDescriptionPanel = React.createClass({

        mixins:[MessagesConsumerMixin],

        updateLabel: function(event){
            this.props.shareModel.setGlobal("label", event.currentTarget.value);
        },

        updateDescription: function(event){
            this.props.shareModel.setGlobal("description", event.currentTarget.value);
        },

        render: function(){
            if(!this.props.shareModel.getNode().isLeaf()){
                var label = (
                    <ReactMUI.TextField
                        floatingLabelText={this.context.getMessage('35')}
                        name="label"
                        onChange={this.updateLabel}
                        value={this.props.shareModel.getGlobal('label')}
                    />
                );
                var labelLegend = (
                    <div className="form-legend">{this.context.getMessage('146')}</div>
                );
            }
            return (
                <div className="reset-pydio-forms">
                    <h3 style={{paddingTop:0}}>{this.context.getMessage('145')}</h3>
                    <div className="label-desc-edit">
                        {label}
                        {labelLegend}
                        <ReactMUI.TextField
                            floatingLabelText="Description"
                            name="description"
                            onChange={this.updateDescription}
                            value={this.props.shareModel.getGlobal('description')}
                        />
                        <div className="form-legend">{this.context.getMessage('197')}</div>
                    </div>
                </div>
            );
        }
    });

    var NotificationPanel = React.createClass({

        mixins:[MessagesConsumerMixin],

        dropDownChange:function(event, index, item){
            this.props.shareModel.setGlobal('watch', (index!=0));
        },

        render: function(){
            var menuItems = [
                {payload:'no_watch', text:this.context.getMessage('187')},
                {payload:'watch_read', text:this.context.getMessage('184')}
                /*,{payload:'watch_write', text:'Notify me when share is modified'}*/
            ];
            var selectedIndex = this.props.shareModel.getGlobal('watch') ? 1 : 0;
            return (
                <div>
                    <h3>Notification</h3>
                    <ReactMUI.DropDownMenu
                        autoWidth={false}
                        className="full-width"
                        menuItems={menuItems}
                        selectedIndex={selectedIndex}
                        onChange={this.dropDownChange}
                    />
                    <div className="form-legend">{this.context.getMessage('188')}</div>
                </div>
            );
        }
    });

    var PublicLinkTemplate = React.createClass({

        mixins:[MessagesConsumerMixin],

        propTypes:{
            linkData:React.PropTypes.object
        },

        onDropDownChange: function(event, index, item){
            this.props.shareModel.setTemplate(this.props.linkData.hash, item.payload);
        },

        render: function(){
            var index = 0, crtIndex = 0;
            var selected = this.props.shareModel.getTemplate(this.props.linkData.hash);
            var menuItems=this.props.layoutData.map(function(l){
                if(selected && l.LAYOUT_ELEMENT == selected) {
                    crtIndex = index;
                }
                index ++;
                return {payload:l.LAYOUT_ELEMENT, text:l.LAYOUT_LABEL};
            });
            return (
                <div>
                    <h3>{this.context.getMessage('151')}</h3>
                    <ReactMUI.DropDownMenu
                        autoWidth={false}
                        className="full-width"
                        menuItems={menuItems}
                        selectedIndex={crtIndex}
                        onChange={this.onDropDownChange}
                    />
                    <div className="form-legend">{this.context.getMessage('198')}</div>
                </div>
            );
        }
    });

    var VisibilityPanel = React.createClass({

        mixins:[MessagesConsumerMixin],

        toggleVisibility: function(){
            this.props.shareModel.toggleVisibility();
        },
        transferOwnership: function(){
            this.props.shareModel.setNewShareOwner(this.refs['newOwner'].getValue());
        },
        render: function(){
            var currentIsOwner = global.pydio.user.id == this.props.shareModel.getShareOwner();

            var legend;
            if(this.props.shareModel.isPublic()){
                if(currentIsOwner){
                    legend = this.context.getMessage('201');
                }else{
                    legend = this.context.getMessage('202');
                }
            }else{
                legend = this.context.getMessage('206');
            }
            var showToggle = (
                <div>
                    <ReactMUI.Checkbox type="checkbox"
                           name="share_visibility"
                           disabled={!currentIsOwner}
                           onCheck={this.toggleVisibility}
                           checked={this.props.shareModel.isPublic()}
                           label={this.context.getMessage('200')}
                    />
                    <div className="section-legend">{legend}</div>
                </div>
            );
            if(this.props.shareModel.isPublic() && currentIsOwner){
                var showTransfer = (
                    <div className="ownership-form">
                        <h4>{this.context.getMessage('203')}</h4>
                        <div className="section-legend">{this.context.getMessage('204')}</div>
                        <div>
                            <ReactMUI.TextField ref="newOwner" floatingLabelText={this.context.getMessage('205')}/>
                            <ReactMUI.RaisedButton label="Transfer" onClick={this.transferOwnership}/>
                        </div>
                    </div>
                );
            }
            return (
                <div className="reset-pydio-forms">
                    <h3>{this.context.getMessage('199')}</h3>
                    {showToggle}
                    {showTransfer}
                </div>
            );
        }
    });

    var DialogNamespace = global.ShareDialog || {};
    DialogNamespace.MainPanel = MainPanel;
    global.ShareDialog = DialogNamespace;

})(window);