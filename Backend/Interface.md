# **接口说明**

## **服务器信息**
+ 协议：https  
+ 主机：www.truemogician.com  
+ 端口：1992  
+ URL：https://www.truemogician.com:1992

## **通用Http状态码**
+ 200：正常
+ 400：请求错误
+ 401：会话过期，需要重新登陆
+ 404：资源不存在
+ 413：负载过大
+ 414：URI过长
+ 501：功能未实现

响应数据不注明状态码默认在200状态下，除此之外上述状态码在每一个请求中都可能出现，除200之外的状态默认响应数据为null。对于某些特殊的接口可能会出现特殊的状态码，或者某个状态码会对应特殊的响应数据，这些情况都会在接口中注明

## 符号说明
+ :zap: : 已实现
+ :zap::zap: : 部分测试
+ :zap::zap::zap: : 全面测试完成

## **Get**
场景：从后端获取资源
+ ### */api/user/hasUser* :zap::zap::zap:
  + 说明：用户是否存在
  + 参数：

    ```ts
    {
    	email: string
    }
    ```
  + 响应：

    ```ts
    {
    	exist: boolean
    }
    ```
+ ### */api/user/login* :zap::zap::zap:
  + 说明：用户登录
  + 参数：

    ```ts
    {
    	email: string
    	password: string
    }
    ```
  + 响应：
    + **403**：密码错误
+ ### */api/user/getAvatar* :zap:
  + 说明：获取用户头像
  + 参数：为null时返回自己的头像

    ```ts
    {
    	userId?: number
    }
    ```
  + 响应：

    ```ts
    {
    	//base64
    	avatar?: string
    }
    ```
+ ### */api/user/getRawAvatar* :zap:
  + 说明：获取用户头像原始文件
  + 参数：为null时返回自己的头像

    ```ts
    {
    	userId?: number
    }
    ```
  + 响应：

    ```ts
    {
    	avatarUrl?: string
    }
    ```
+ ### */api/user/getInformation* :zap:
  + 说明：获取用户基本信息
  + 参数：其中为true的会在响应中有，默认为false，响应中对应内容为null

    ```ts
    {
    	avatar?: boolean
    	phone?: boolean
    	qq?: boolean
    	gender? boolean
    }
    ```
  + 响应：

    ```ts
    {
    	id: number
    	username: string
    	administrator: boolean
    	email: string
    	reputation: number
    	joinDate: Date
    	//base64编码
    	avatar?: string
    	phone?: number
    	qq?: string
    	gender?: "Male"|"Female"|"Other"|"Secret"
    }
    ```
+ ### */api/user/isAdministrator* :zap::zap::zap:
  + 说明：用户是否为管理员
  + 响应：

    ```ts
    {
    	isAdmin: boolean
    }
    ```
+ ### */api/user/hasDropped* :zap:
  + 说明：用户是否已注销或被永久封禁
  + 参数：

    ```ts
    {
    	userId: number
    }
    ```
  + 响应：

    ```ts
    {
    	//如果用户存在为null
    	dropDate?: Date
    }
    ```
+ ### */api/user/hasVotedProblem*
  + 说明：是否对问题投过票
  + 参数：

    ```ts
    {
    	id: number
    }
    ```
  + 响应：-1表示投反对，0表示没投，1表示投赞同

    ```ts
    {
    	status: -1|0|1
    }
    ```
+ ### */api/user/getLogs*
  + 说明：获取历史记录
  + 参数：结果按两个条件取交集，默认获取最近的10条记录

    ```ts
    {
    	//获取的记录条数
    	limit?: number
    	//截止日期
    	date?: Date
    }
    ```

  + 响应：detail的解析会提供一个parser，其中包含针对不同Type的interface

    ```ts
    Array<{
    	id: string
    	type: "Register"|"Close"|"Login"|"Logout"|"Modify""Donate"|"Judge"|"Create"|"Revise"|"Response"|"Delete"|"Vote"|"Comment"|"Suspend"|"Terminate"|"Administrate"
    	date: Date
    	detail?: string
    }>
    ```
+ ### */api/user/getJudgements*
  + 说明：获取评测记录
  + 参数：结果按两个条件取交集，默认获取最近的10条记录

    ```ts
    {
    	//获取的记录条数
    	limit?: number
    	//截止日期
    	date?: Date
    }
    ```

  + 响应：对于自测记录，problemId和problemTitle都为null

    ```ts
    Array<{
    	id: number
    	problemId?：number
    	problemTitle?: string
    	status: "CompilationError"|"Passed"|"Found"
    	date: Date
    }>
    ```
+ ### */api/tag/getAll* :zap::zap::zap:
  + 说明：获取所有标签
  + 响应：包含所有标签名字的数组

    ```ts
    string[]
    ```
+ ### */api/tag/getDescriptions* :zap::zap::zap:
  + 说明：获取标签描述
  + 参数：

    ```ts
    {
    	names: string[]
    }
    ```
  + 响应：从name到description的映射

    ```ts
    Map<string,string>
    ```
+ ### */api/problem/search*
  + 说明：搜索问题
  + 参数：id和title、tags不能同时有值

    ```ts
    {
    	id?: number
    	title?: string
    	tags?: string[]
    }
    ```
  + 响应：

    ```ts
    Array<{
    	id: number
    	title: string
    	tags: string[]
    	authorId: number
    	vote: number
    }>
    ```
+ ### */api/problem/getProblems* :zap:
  + 说明：获取题目列表
  + 参数：

    ```ts
    {
    	//跳过的条数，默认为0
    	skip?:number
    	//按照id顺序获取的条数，默认为10
    	count?: number
    }
    ```
  + 响应：

    ```ts
    Array<{
    	id: number
    	title: string
    	tags: string[]
    	authorId: number
    	voteCount: number
    }>
    ```
+ ### */api/problem/getDetail* :zap:
  + 说明：获取题目细节
  + 参数：

    ```ts
    {
    	id: number
    }
    ```
  + 响应：

    ```ts
    {
    	id: number
    	title: string
    	description: string
    	tags?: string[]
     	authorId: number
    	contributorsId?: number[]
    	voteCount: number
    	datamakersId?: number[]
    	standardsId?: number[]
    	judgersId?: number[]
    }
    ```
+ ### */api/judgement/getStatus*
  + 说明：获取评测实时状态
  + 参数：

    ```ts
    {
    	judgementId: number
    }
    ```
  + 响应：

    ```ts
    {
    	//为false表示编译失败，此时后续内容只有errorMessage有意义
    	compiled: boolean
    	errorMessage?: string
    	hasExited: boolean
    	progress: number
    	maxTime: number
    	hasAnalysis: boolean
    	totalTime?:{
      		datamaker: number
      		standard: number
      		judged: number
    	}
    	//为false表示尚未找到差异，此时下面三个Data都是null
    	differed: boolean
    	inputData?: string
    	answerData?: string
    	outputData?: string
    }
    ```
+ ### */api/source/getSource* :zap::zap::zap:
  + 说明：获取源程序
  + 参数：

    ```ts
    {
    	id: number
    }
    ```
  + 响应：

    ```ts
    {
    	id: number
    	type: "Datamaker"|"Standard"|"Judged"|"Judger"
    	language: string
    	compiler: string
    	voteUp: number
    	voteDown: number
    	authorId: number
    	contributorsId?: number[]
    	//除题目的数据生成器，标准程序和判别器外都为null
    	problemId?: number
    }
    ```
+ ### */api/source/getCode* :zap::zap::zap:
  + 说明：获取代码
  + 参数：

    ```ts
    {
    	id: number
    }
    ```
  + 响应：

    ```ts
    {
    	code: string
    }
    ```
+ ### */api/language/getAll* :zap::zap::zap:
  + 说明：获取受支持的语言
  + 响应：

    ```ts
    Array<{
    	name: string
    	standard?: string[]
    	compilers: string[]
    }>
    ```


## **Post**
场景：向后端添加资源
+ ### */api/user/sendEmail* :zap::zap::zap:
  + 说明：发送验证邮件
  + 参数：

    ```ts
    {
    	email: string
    }
    ```
  + 响应：
    + **429**：请求过于频繁

    ```ts
    {
    	//距下一次请求剩余的时间，单位ms
    	timeLeft: number
    }
    ```
+ ### */api/user/register* :zap::zap::zap:
  + 说明：向数据库中添加用户
  + 负载：

    ```ts
    {
    	//长度<=32 字母数字下划线
      username: string
      //长度<=32
      password: string
    	//长度<=64
      email: string
    	//4位字母数字
    	verificationCode: string
    	//11位数字
    	phone?: number
    	//6<=长度<=12
    	qq?: string
    }
    ```

  + 响应：
    + **201**：创建成功

    ```ts
    {
    	id: number
    }
    ```
    + **403**：邮箱验证码错误或过期
+ ### */api/problem/create* :zap:
  + 说明：创建题目
  + 负载：

    ```ts
    {
    	//1<=长度<=255
    	title: string
    	//markdown，长度<16M
    	description: string
    	tags?: string[]
    }
    ```
  
  + 响应：
    + **201**：创建成功

    ```ts
    {
    	id: number
    }
    ```
+ ### */api/source/upload* :zap::zap:
  + 说明：上传代码
  + 参数：个人评测时参数留空

    ```ts
    {
    	problemId?: number
    }
    ```
  + 负载：使用HTML表单
    + source : File
    + type : "Datamaker"|"Standard"|"Judged"|"Judger"
    + language : Text
    + languageStandard : Text
    + compiler : Text
  + 响应：

    ```ts
    {
    	id: number
    }
    ```
+ ### */api/tag/create* :zap::zap::zap:
  + 说明：创建标签
  + 负载：

    ```ts
    {
      //1<=长度<=16
      name: string
      //长度<=255
    	description?: string
    }
    ```
+ ### */api/judgement/start*
  + 说明：进行评测
  + 负载：

    ```ts
    {
    	datamakerId: number
    	standardId: number
    	judgedId: number
    	datamakerArguments?: string
    	maxTime: number
    }
    ```
  + 响应：

    ```ts
    {
    	judgementId: number
    }
    ```

## **Put**
场景：修改后端资源
+ ### */api/user/modify* :zap::zap::zap:
  + 说明：修改用户信息
  + 负载：

    ```ts
    {
    	username?: string
    	password?: string
    	phone?: string
    	qq?: string
    	gender?: "Male"|"Female"|"Other"|"Secret"
    }
    ```
+ ### */api/user/uploadAvatar* :zap:
  + 说明：上传用户头像
  + 负载：使用HTML表单
    + uploadedImage
+ ### */api/problem/modify*
  + 说明：创建者修改题目
  + 负载：
  
    ```ts
    {
    	title?: string
    	description?: number
    	tags?: string[]
    }
    ```
+ ### */api/problem/vote*
  + 说明：对问题投票
  + 参数：

    ```ts
    {
    	id: number
    }
    ```
  + 负载：默认赞同，false表示反对

    ```ts
    {
    	voteup？: boolean
    }
    ```
  + 响应：
    + **409**：冲突，已经投过了

## Delete
场景：删除或关闭后端资源
+ ### */api/user/logout* :zap::zap::zap:
  + 说明：用户登出
+ ### */api/user/drop*
  + 说明：注销用户
+ ### */api/problem/close*
  + 说明：关闭题目
  + 参数：

    ```ts
    {
    	id: number
    }
    ```